let allOrders = [];
let currentlyInspectedId = null;
let targetActionOrderId = null;
let actionTypeInProgress = 'reject';
let isInitialLoad = true;

db.collection('orders').onSnapshot((snapshot) => {
    allOrders = snapshot.docs.map(doc => {
        const d = doc.data();
        d._docId = doc.id;
        d.id = d.id || doc.id;
        return d;
    });

    renderKanban();
    updateBadgeCounts();

    if (currentlyInspectedId) {
        const updated = allOrders.find(o => o.id === currentlyInspectedId || o._docId === currentlyInspectedId);
        if (updated && document.getElementById('details-modal').classList.contains('active')) renderOrderDetailsBody(updated);
    }
});

setInterval(() => {
    const now = Date.now();
    let changed = false;
    allOrders.forEach(order => {
        if (order.status === 'pending') {
            const created = getSafeTime(order.createdAt) || getSafeTime(order.clientTimestamp) || now;
            const elapsed = Math.floor((now - created) / 1000);
            if (elapsed >= 60) {
                order.status = 'cancelled_timeout';
                changed = true;
                playCancelChime();
                showInteractiveToast('cancel', 'انتهت مهلة الطلب (#' + formatOrderNum(order) + ')', 'تم حذفه تلقائياً لتجاوزه 60 ثانية دون تأكيد');
                db.collection('orders').doc(order._docId || order.id).update({
                    status: 'cancelled_timeout',
                    rejectReason: 'انتهت مهلة المراجعة (60 ثانية)',
                    cancelledAt: firebase.firestore.FieldValue.serverTimestamp()
                }).catch(() => {});
            } else {
                const bar = document.getElementById('pending-bar-' + order.id);
                const txt = document.getElementById('pending-sec-' + order.id);
                if (bar && txt) {
                    const rem = Math.max(0, 60 - elapsed);
                    txt.innerText = rem + ' ثانية';
                    bar.style.width = ((rem / 60) * 100) + '%';
                }
            }
        }
    });
    if (changed) { renderKanban(); updateBadgeCounts(); }
}, 1000);

function updateBadgeCounts() {
    const pending = allOrders.filter(o => o.status === 'pending').length;
    const accepted = allOrders.filter(o => o.status === 'accepted').length;
    const completed = allOrders.filter(o => o.status === 'completed').length;
    const bLive = document.getElementById('badge-live-count'); if (bLive) bLive.innerText = pending;
    const cPending = document.getElementById('count-pending'); if (cPending) cPending.innerText = pending;
    const cAccepted = document.getElementById('count-accepted'); if (cAccepted) cAccepted.innerText = accepted;
    const cDone = document.getElementById('count-done'); if (cDone) cDone.innerText = completed;

    let delayed = 0;
    const now = new Date();
    allOrders.filter(o => o.status === 'accepted').forEach(o => {
        const prep = o.prepTime || 25;
        const created = o.acceptedAt ? new Date(getSafeTime(o.acceptedAt)) : new Date(getSafeTime(o.createdAt) || now);
        if ((now - created) / 60000 > prep) delayed++;
    });
    const statTotal = document.getElementById('stat-total-display-count');
    if (statTotal) statTotal.innerText = allOrders.filter(o => !o.status.startsWith('cancel') && o.status !== 'rejected').length;
    const statDelayed = document.getElementById('stat-delayed-count');
    if (statDelayed) statDelayed.innerText = delayed;
}

function renderKanban() {
    const colPending = document.getElementById('col-pending-orders');
    const colAccepted = document.getElementById('col-accepted-orders');
    const colDone = document.getElementById('col-done-orders');
    if (!colPending || !colAccepted || !colDone) return;
    colPending.innerHTML = ''; colAccepted.innerHTML = ''; colDone.innerHTML = '';

    const active = allOrders.filter(o => {
        if (o.status === 'cancelled_timeout' || o.status.startsWith('cancel') || o.status === 'rejected') return false;
        if (o.status === 'pending') {
            const created = getSafeTime(order.createdAt) || getSafeTime(order.clientTimestamp) || Date.now();
            if ((Date.now() - created) / 1000 >= 60) return false;
        }
        return true;
    });

    active.forEach(order => {
        const num = formatOrderNum(order);
        const card = document.createElement('div');
        card.className = 'order-card ' + order.status;
        card.id = 'card-order-' + order.id;

        let widget = '';
        if (order.status === 'pending') {
            widget = '<div class="pending-expiry-wrap"><div class="pending-expiry-header"><span><i class="fas fa-stopwatch"></i> مهلة المراجعة (60ث)</span><span id="pending-sec-' + order.id + '">60 ثانية</span></div><div class="pending-expiry-bar-bg"><div class="pending-expiry-bar-fill" id="pending-bar-' + order.id + '"></div></div></div>';
        } else if (order.status === 'accepted') {
            widget = '<div class="order-timer-progress-wrap"><div class="timer-header-info"><span style="color:var(--text-muted);"><i class="fas fa-hourglass-half"></i> مدة التجهيز: ' + (order.prepTime || 25) + 'د</span><span id="timer-text-' + order.id + '" class="text-time-normal" style="font-weight:900;">جاري التحضير</span></div></div>';
        }

        const itemsSummary = (order.items || []).map(i => i.qty + 'x ' + escapeHTML(i.name)).join(' ، ');
        card.innerHTML = '<div class="card-top"><span class="card-id">#' + num + '</span><span class="tag-pill ' + (order.orderType === 'delivery' ? 'tag-delivery' : 'tag-pickup') + '">' + (order.orderType === 'delivery' ? 'توصيل مجاني' : 'استلام فرع') + '</span></div>' +
            '<div class="card-cust"><span>' + escapeHTML(order.customerName || order.customer || 'زبون') + '</span><span>' + new Date(getSafeTime(order.createdAt)).toLocaleTimeString('ar-SY', {hour:'2-digit', minute:'2-digit'}) + '</span></div>' +
            '<div class="card-phones-row"><span class="phone-badge-card">' + escapeHTML(order.phone) + '</span></div>' +
            '<div class="card-items-snippet">' + itemsSummary + '</div>' + widget +
            '<div class="card-bottom"><span style="color:var(--text-muted);">المجموع:</span><span class="card-total">' + Number(order.total || 0).toLocaleString() + ' ل.س</span></div>' +
            (order.status === 'pending' ? '<button class="btn-ready-card" style="border-color:var(--primary); color:var(--primary); background:rgba(255,106,25,0.15);" onclick="openOrderDetails(\'' + order.id + '\')"><i class="fas fa-clipboard-check"></i> معاينة وقبول الطلب</button>' : order.status === 'accepted' ? '<button class="btn-ready-card" onclick="markCompleted(\'' + order.id + '\', event)"><i class="fas fa-check-circle"></i> الطلب جاهز للتسليم</button>' : '');

        card.onclick = (e) => { if (!e.target.closest('button')) openOrderDetails(order.id); };
        if (order.status === 'pending') colPending.appendChild(card);
        else if (order.status === 'accepted') colAccepted.appendChild(card);
        else colDone.appendChild(card);
    });
}

function openOrderDetails(orderId) {
    currentlyInspectedId = orderId;
    const order = allOrders.find(o => o.id === orderId || o._docId === orderId);
    if (!order) return;
    const dtId = document.getElementById('dt-id'); if (dtId) dtId.innerText = '#' + formatOrderNum(order);
    renderOrderDetailsBody(order);
    const m = document.getElementById('details-modal'); if (m) m.classList.add('active');
}
function closeDetailsModal() { const m = document.getElementById('details-modal'); if (m) m.classList.remove('active'); currentlyInspectedId = null; }

function renderOrderDetailsBody(order) {
    const body = document.getElementById('details-modal-body');
    const footer = document.getElementById('details-modal-footer');
    if (!body || !footer) return;
    let itemsTable = (order.items || []).map(it => '<tr><td style="padding:8px 0;"><b>' + escapeHTML(it.name) + '</b></td><td style="text-align:center;">' + it.qty + 'x</td><td style="text-align:left;">' + (it.qty * it.price).toLocaleString() + ' ل.س</td></tr>').join('');

    body.innerHTML = (order.status === 'pending' ? '<div class="detail-card"><div class="detail-card-title"><i class="fas fa-stopwatch"></i> تحديد وقت التحضير (دقيقة)</div><div class="prep-stepper-container"><button class="btn-stepper-round" onclick="stepDetailTime(\'' + order.id + '\', -5)">-5</button><span class="stepper-time-number" id="detail-time-val-' + order.id + '">' + (order.prepTime || 25) + '</span><button class="btn-stepper-round" onclick="stepDetailTime(\'' + order.id + '\', 5)">+5</button></div></div>' : '') +
        '<div class="detail-card"><div class="grid-2"><div class="detail-row"><span class="detail-label">الزبون</span><span class="detail-val">' + escapeHTML(order.customerName || order.customer || 'زبون') + '</span></div><div class="detail-row"><span class="detail-label">الهاتف</span><span class="detail-val">' + escapeHTML(order.phone) + '</span></div>' +
        (order.address ? '<div class="detail-row" style="grid-column:span 2;"><span class="detail-label">العنوان</span><span class="detail-val">' + escapeHTML(order.address) + '</span></div>' : '') +
        (order.notes ? '<div class="detail-row" style="grid-column:span 2;"><span class="detail-label">ملاحظات</span><span class="detail-val" style="color:var(--warning);">' + escapeHTML(order.notes) + '</span></div>' : '') +
        '</div></div><div class="detail-card"><table style="width:100%; border-collapse:collapse;">' + itemsTable + '</table></div>';

    footer.innerHTML = '<div><span style="font-size:1.4rem; font-weight:900; color:var(--neon-green);">' + Number(order.total || 0).toLocaleString() + ' ل.س</span></div>' +
        '<div style="display:flex; gap:8px;"><button class="btn-action-top" onclick="printReceipt(\'' + order.id + '\')"><i class="fas fa-print"></i> طباعة 80mm</button>' +
        (order.status === 'pending' ? '<button class="btn-action-top" style="background:var(--primary); color:white; border:none;" onclick="confirmAcceptOrder(\'' + order.id + '\')"><i class="fas fa-check"></i> قبول الطلب</button>' : order.status === 'accepted' ? '<button class="btn-action-top" style="background:#dc2626; color:white; border:none;" onclick="openRejectDialog(\'' + order.id + '\', \'cancel_accepted\')"><i class="fas fa-trash-alt"></i> هدر مطبخ</button>' : '') + '</div>';
}

function stepDetailTime(orderId, delta) {
    const o = allOrders.find(x => x.id === orderId || x._docId === orderId);
    if (!o) return;
    o.prepTime = Math.max(5, (o.prepTime || 25) + delta);
    const el = document.getElementById('detail-time-val-' + o.id); if (el) el.innerText = o.prepTime;
}
async function confirmAcceptOrder(orderId) {
    const o = allOrders.find(x => x.id === orderId || x._docId === orderId);
    if (!o) return;
    const prep = o.prepTime || 25;
    await db.collection('orders').doc(o._docId || o.id).update({
        status: 'accepted', prepTime: prep, acceptedAt: firebase.firestore.FieldValue.serverTimestamp(),
        messages: firebase.firestore.FieldValue.arrayUnion({ id: 'msg_' + Date.now(), sender: 'system', text: '✅ تم قبول طلبك! وقت التجهيز: ' + prep + ' دقيقة.', time: new Date().toLocaleTimeString('ar-SY', {hour:'2-digit', minute:'2-digit'}), status: 'read' })
    });
    closeDetailsModal();
}
async function markCompleted(orderId, e) {
    if (e) e.stopPropagation();
    const o = allOrders.find(x => x.id === orderId || x._docId === orderId);
    if (!o) return;
    await db.collection('orders').doc(o._docId || o.id).update({
        status: 'completed', completedAt: firebase.firestore.FieldValue.serverTimestamp(),
        messages: firebase.firestore.FieldValue.arrayUnion({ id: 'msg_' + Date.now(), sender: 'system', text: '🍗 طلبك جاهز بالكامل!', time: new Date().toLocaleTimeString('ar-SY', {hour:'2-digit', minute:'2-digit'}), status: 'read' })
    });
}
function printReceipt(orderId) {
    const o = allOrders.find(x => x.id === orderId || x._docId === orderId);
    if (!o) return;
    const num = formatOrderNum(o);
    let items = (o.items || []).map(it => '<div style="display:flex; justify-content:space-between;"><span>' + it.qty + 'x ' + escapeHTML(it.name) + '</span><span>' + (it.qty * it.price).toLocaleString() + '</span></div>').join('');
    const html = '<!DOCTYPE html><html lang="ar" dir="rtl"><head><style>@page{size:80mm auto; margin:0;} body{margin:0; padding:10px; font-family:\'Tajawal\', monospace; font-size:13px; text-align:right;} hr{border:none; border-top:1px dashed #000;}</style></head><body><h2 style="text-align:center;">FLY CHICKEN</h2><p style="text-align:center; font-size:16px; font-weight:900;">طلب #' + num + '</p><hr><div>الزبون: <b>' + escapeHTML(o.customerName || o.customer) + '</b></div><div>الهاتف: ' + escapeHTML(o.phone) + '</div>' + (o.address ? '<div>العنوان: ' + escapeHTML(o.address) + '</div>' : '') + '<hr>' + items + '<hr><div style="display:flex; justify-content:space-between; font-weight:bold; font-size:15px;"><span>المجموع:</span><span>' + Number(o.total || 0).toLocaleString() + ' ل.س</span></div></body></html>';
    const iframe = document.getElementById('print-iframe');
    if (!iframe) return;
    const doc = iframe.contentWindow.document; doc.open(); doc.write(html); doc.close();
    setTimeout(() => { iframe.contentWindow.focus(); iframe.contentWindow.print(); }, 250);
}
