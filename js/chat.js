let activeChatOrderId = null;

function renderChatHub() {
    const container = document.getElementById('chat-contacts-container');
    if (!container) return;
    container.innerHTML = '';

    const threads = allOrders.filter(o => (o.messages && o.messages.length > 0) || o.phone || o.customerName);
    if (threads.length === 0) {
        container.innerHTML = '<div style="padding:40px 15px; text-align:center; color:var(--text-muted);">لا توجد محادثات زبائن حالياً</div>';
        return;
    }

    const sorted = [...threads].sort((a,b) => (getSafeTime(b.lastMessageAt) || getSafeTime(b.createdAt)) - (getSafeTime(a.lastMessageAt) || getSafeTime(a.createdAt)));
    sorted.forEach(order => {
        const div = document.createElement('div');
        div.className = 'contact-item ' + (activeChatOrderId === order.id ? 'active' : '') + (order._hasUnread ? ' has-unread-msg' : '');
        const msgs = order.messages || [];
        const lastMsg = msgs.length ? msgs[msgs.length - 1] : { text: 'بدء المحادثة', sender: 'system' };
        div.innerHTML = '<div class="contact-avatar"><i class="fas fa-user"></i></div><div class="contact-info"><div class="contact-title-row"><span class="contact-name-phone">' + escapeHTML(order.customerName || order.customer || 'زبون') + '</span><span class="contact-order-id">#' + formatOrderNum(order) + '</span></div><div class="contact-last-msg">' + escapeHTML(lastMsg.text) + '</div></div>';
        div.onclick = () => selectChatThread(order);
        container.appendChild(div);
    });
}

function selectChatThread(order) {
    activeChatOrderId = order.id;
    order._hasUnread = false;
    const unreadEl = document.getElementById('badge-chat-unread');
    if (unreadEl) unreadEl.style.display = allOrders.some(x => x._hasUnread) ? 'inline-block' : 'none';
    renderChatHub();
    const titleEl = document.getElementById('active-chat-title');
    if (titleEl) titleEl.innerText = (order.customerName || order.customer || 'زبون') + ' (' + order.phone + ')';
    const subEl = document.getElementById('active-chat-subtitle');
    if (subEl) subEl.innerText = 'طلب #' + formatOrderNum(order);

    const stream = document.getElementById('active-chat-messages');
    if (!stream) return;
    stream.innerHTML = '';
    (order.messages || []).forEach(m => {
        stream.innerHTML += '<div class="bubble-wa ' + escapeHTML(m.sender) + '"><div>' + escapeHTML(m.text) + '</div><div class="bubble-meta"><span>' + escapeHTML(m.time || '') + '</span></div></div>';
    });
    stream.scrollTop = stream.scrollHeight;
}

async function sendChatMessageDirect() {
    const input = document.getElementById('chat-input-message');
    if (!input) return;
    const text = input.value.trim();
    if (!text || !activeChatOrderId) return;
    const o = allOrders.find(x => x.id === activeChatOrderId || x._docId === activeChatOrderId);
    input.value = '';
    await db.collection('orders').doc(o._docId || activeChatOrderId).update({
        messages: firebase.firestore.FieldValue.arrayUnion({ id: 'msg_' + Date.now(), sender: 'restaurant', text: text, time: new Date().toLocaleTimeString('ar-SY', {hour:'2-digit', minute:'2-digit'}), status: 'delivered' }),
        lastMessageAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}
function filterChatContacts() {
    const q = document.getElementById('chat-search').value.toLowerCase();
    document.querySelectorAll('#chat-contacts-container .contact-item').forEach(it => {
        it.style.display = it.innerText.toLowerCase().includes(q) ? 'flex' : 'none';
    });
}
