let defaultCostRatio = parseFloat(localStorage.getItem('fc_cost_ratio') || '0.55');
let pinCallback = null;
const MANAGER_PIN = "1234";

function loadShiftReport(mode = 'today') {
    let filtered = [];
    const now = new Date();

    if (mode === 'today') {
        let shiftDate = new Date(now);
        if (now.getHours() < 12) shiftDate.setDate(shiftDate.getDate() - 1);
        const year = shiftDate.getFullYear();
        const month = shiftDate.getMonth();
        const day = shiftDate.getDate();
        const shiftStart = new Date(year, month, day, 12, 0, 0);
        const shiftEnd = new Date(year, month, day + 1, 3, 0, 0);
        filtered = allOrders.filter(o => {
            const d = new Date(getSafeTime(o.createdAt));
            return d >= shiftStart && d <= shiftEnd && (o.status === 'completed' || o.status === 'accepted');
        });
    } else if (mode === 'custom') {
        const sVal = document.getElementById('sales-start-datetime').value;
        const eVal = document.getElementById('sales-end-datetime').value;
        if (!sVal || !eVal) return alert('يرجى تحديد وقت وتاريخ البداية والنهاية');
        const s = new Date(sVal);
        const e = new Date(eVal);
        filtered = allOrders.filter(o => {
            const d = new Date(getSafeTime(o.createdAt));
            return d >= s && d <= e && (o.status === 'completed' || o.status === 'accepted');
        });
    }

    const totalRevenue = filtered.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const itemMap = {};

    filtered.forEach(o => {
        (o.items || []).forEach(it => {
            if (!itemMap[it.name]) {
                const unitCost = Math.round((it.price || 0) * defaultCostRatio);
                itemMap[it.name] = { name: it.name, price: it.price || 0, qty: 0, revenue: 0, unitCost, totalCost: 0 };
            }
            itemMap[it.name].qty += it.qty;
            itemMap[it.name].revenue += (it.qty * it.price);
            itemMap[it.name].totalCost += (it.qty * itemMap[it.name].unitCost);
        });
    });

    const itemsArr = Object.values(itemMap).sort((a,b) => b.qty - a.qty);
    const totalCosts = itemsArr.reduce((sum, i) => sum + i.totalCost, 0);
    const netProfit = totalRevenue - totalCosts;

    const elSales = document.getElementById('shift-total-sales'); if (elSales) elSales.innerText = totalRevenue.toLocaleString() + ' ل.س';
    const elCosts = document.getElementById('shift-total-costs'); if (elCosts) elCosts.innerText = totalCosts.toLocaleString() + ' ل.س';
    const elProfit = document.getElementById('shift-net-profit'); if (elProfit) elProfit.innerText = netProfit.toLocaleString() + ' ل.س';
    const elCount = document.getElementById('shift-orders-count'); if (elCount) elCount.innerText = filtered.length;

    const tbody = document.getElementById('items-sales-body');
    if (tbody) {
        tbody.innerHTML = '';
        if (itemsArr.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-muted);">لا توجد مبيعات في هذه الفترة</td></tr>';
        } else {
            itemsArr.forEach(it => {
                const profit = it.revenue - it.totalCost;
                const margin = it.revenue > 0 ? Math.round((profit / it.revenue) * 100) : 0;
                tbody.innerHTML += '<tr>' +
                    '<td><b>' + escapeHTML(it.name) + '</b></td>' +
                    '<td><span class="tag-pill" style="background:rgba(255,255,255,0.1);">' + it.qty + ' وجبة</span></td>' +
                    '<td style="color:var(--neon-green); font-weight:900;">' + it.revenue.toLocaleString() + ' ل.س</td>' +
                    '<td>' + it.unitCost.toLocaleString() + ' ل.س</td>' +
                    '<td style="color:var(--neon-red);">' + it.totalCost.toLocaleString() + ' ل.س</td>' +
                    '<td style="color:var(--neon-blue); font-weight:900;">' + profit.toLocaleString() + ' ل.س</td>' +
                    '<td><span class="tag-pill" style="background:rgba(0,255,136,0.15); color:var(--neon-green);">' + margin + '%</span></td>' +
                    '</tr>';
            });
        }
    }
}

function renderCustomerCRM() {
    const customerMap = {};
    allOrders.forEach(o => {
        const rawPhone = o.phone;
        if (!rawPhone) return;
        let clean = String(rawPhone).replace(/[^0-9]/g, '');
        if (clean.startsWith('09')) clean = '963' + clean.substring(1);

        if (!customerMap[clean]) {
            customerMap[clean] = {
                name: o.customerName || o.customer || 'زبون',
                phone: clean,
                origPhone: o.phone,
                secondaryPhone: o.secondaryPhone || '',
                totalOrders: 0,
                totalSpent: 0,
                itemsFrequency: {},
                addresses: []
            };
        }
        customerMap[clean].totalOrders += 1;
        customerMap[clean].totalSpent += (Number(o.total) || 0);
        if (o.address && !customerMap[clean].addresses.includes(o.address)) {
            customerMap[clean].addresses.push(o.address);
        }
        (o.items || []).forEach(it => {
            customerMap[clean].itemsFrequency[it.name] = (customerMap[clean].itemsFrequency[it.name] || 0) + it.qty;
        });
    });

    const customersList = Object.values(customerMap).sort((a,b) => b.totalSpent - a.totalSpent);
    const tbody = document.getElementById('customers-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    customersList.forEach(c => {
        let favItem = '--';
        let maxQty = 0;
        for (let k in c.itemsFrequency) {
            if (c.itemsFrequency[k] > maxQty) { maxQty = c.itemsFrequency[k]; favItem = k + ' (' + maxQty + ')'; }
        }
        let tier = '<span class="new-badge">🆕 جديد</span>';
        if (c.totalOrders >= 5 || c.totalSpent > 300000) tier = '<span class="vip-badge">⭐ VIP ذهبي</span>';
        else if (c.totalOrders >= 2) tier = '<span class="regular-badge">🔁 دائم</span>';

        const avgTicket = c.totalOrders > 0 ? Math.round(c.totalSpent / c.totalOrders) : 0;
        tbody.innerHTML += '<tr>' +
            '<td><b>' + escapeHTML(c.name) + '</b></td>' +
            '<td>' + tier + '</td>' +
            '<td>' + escapeHTML(c.origPhone) + '</td>' +
            '<td>' + escapeHTML(c.secondaryPhone || '--') + '</td>' +
            '<td><b>' + c.totalOrders + '</b></td>' +
            '<td style="color:var(--neon-green); font-weight:900;">' + c.totalSpent.toLocaleString() + ' ل.س</td>' +
            '<td style="color:var(--primary); font-weight:800;">' + avgTicket.toLocaleString() + ' ل.س</td>' +
            '<td style="color:var(--neon-blue); font-weight:800;">' + escapeHTML(favItem) + '</td>' +
            '<td><small>' + escapeHTML(c.addresses.join(' | ') || 'استلام صالة') + '</small></td>' +
            '<td><a href="https://wa.me/' + c.phone + '" target="_blank" class="btn-action-top" style="height:30px; text-decoration:none; padding:0 8px;"><i class="fab fa-whatsapp" style="color:var(--wa-green);"></i></a></td>' +
            '</tr>';
    });
}

function filterCustomerTable() {
    const q = document.getElementById('crm-search').value.toLowerCase();
    document.querySelectorAll('#customers-table-body tr').forEach(tr => {
        tr.style.display = tr.innerText.toLowerCase().includes(q) ? '' : 'none';
    });
}

function saveCostRatio() {
    const val = parseInt(document.getElementById('setting-cost-ratio').value);
    if (val >= 5 && val <= 95) {
        defaultCostRatio = val / 100;
        localStorage.setItem('fc_cost_ratio', defaultCostRatio);
        alert('تم تحديث نسبة التكلفة بنجاح');
    }
}

function exportCompleteDataHTML() {
    const exportTimestamp = new Date().toLocaleString('ar-SY');
    const standaloneHTML = '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>أرشيف Fly Chicken</title>' +
        '<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@700;900&display=swap" rel="stylesheet">' +
        '<style>body{font-family:\'Tajawal\', sans-serif; background:#0b0e14; color:#fff; padding:25px; direction:rtl;}' +
        '.box{background:#151b24; border:1px solid #242d3c; border-radius:12px; padding:20px; margin-bottom:25px;}' +
        'h1{color:#ff6a19;} table{width:100%; border-collapse:collapse; margin-top:15px;}' +
        'th{background:#1c2430; padding:12px; text-align:right; color:#8fa0b5; border-bottom:1px solid #242d3c; font-weight:900;}' +
        'td{padding:12px; border-bottom:1px solid #242d3c; font-weight:700;}' +
        '.green{color:#00ff88; font-weight:900;} .badge{background:rgba(255,106,25,0.15); color:#ff6a19; padding:3px 8px; border-radius:6px; font-weight:900;}</style></head><body>' +
        '<div class="box"><h1>🍗 أرشيف نظام Fly Chicken الكامل</h1><p>تاريخ التصدير: <b>' + exportTimestamp + '</b> | الطلبات: <b>' + allOrders.length + '</b></p></div>' +
        '<div class="box"><h2>🧾 قائمة الطلبات</h2><table><thead><tr><th>الطلب</th><th>التاريخ</th><th>الزبون</th><th>الهاتف</th><th>النوع</th><th>المجموع</th><th>الحالة</th></tr></thead><tbody>' +
        allOrders.map(o => '<tr><td><b>#' + formatOrderNum(o) + '</b></td><td>' + new Date(getSafeTime(o.createdAt)).toLocaleString('ar-SY') + '</td><td>' + escapeHTML(o.customerName || o.customer || 'زبون') + '</td><td>' + escapeHTML(o.phone) + '</td><td><span class="badge">' + escapeHTML(o.orderType) + '</span></td><td class="green">' + Number(o.total || 0).toLocaleString() + ' ل.س</td><td>' + escapeHTML(o.status) + '</td></tr>').join('') +
        '</tbody></table></div></body></html>';

    const blob = new Blob([standaloneHTML], { type: 'text/html;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'FlyChicken_Full_Archive_' + new Date().toISOString().split('T')[0] + '.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function requirePinAuth(callback) {
    pinCallback = callback;
    const pinInp = document.getElementById('manager-pin-input');
    if (pinInp) pinInp.value = '';
    const m = document.getElementById('pin-modal');
    if (m) m.classList.add('active');
}

function verifyManagerPin() {
    const val = document.getElementById('manager-pin-input').value;
    if (val === MANAGER_PIN) {
        closeModal('pin-modal');
        if (pinCallback) pinCallback();
    } else {
        alert('رمز PIN غير صحيح!');
    }
}
