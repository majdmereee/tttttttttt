const defaultMenu = [
    { name: 'شاورما كبيرة', price: 18000, isAvailable: true },
    { name: 'شاورما وسط', price: 14000, isAvailable: true },
    { name: 'وجبة عربي دبل', price: 45000, isAvailable: true },
    { name: 'وجبة كريسبي', price: 55000, isAvailable: true },
    { name: 'برغر كلاسيك لحم', price: 35000, isAvailable: true },
    { name: 'بيغ برغر', price: 50000, isAvailable: true },
    { name: 'فروج بروستد', price: 100000, isAvailable: true },
    { name: 'سندويش بطاطا', price: 15000, isAvailable: true },
    { name: 'صحن بطاطا كبير', price: 50000, isAvailable: true },
    { name: 'بيبسي تنك', price: 6000, isAvailable: true }
];

let liveMenuItems = defaultMenu;

db.collection('settings').doc('menu_data').onSnapshot((doc) => {
    if (doc.exists && doc.data().items) {
        liveMenuItems = doc.data().items;
    } else {
        db.collection('settings').doc('menu_data').set({ items: defaultMenu });
    }
    renderMenuManagerTable();
});

function renderMenuManagerTable() {
    const tbody = document.getElementById('menu-manager-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    liveMenuItems.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td><b>' + escapeHTML(item.name) + '</b></td>' +
            '<td><span style="color:var(--neon-green); font-weight:900;">' + Number(item.price).toLocaleString() + ' ل.س</span></td>' +
            '<td><label class="toggle-switch"><input type="checkbox" ' + (item.isAvailable !== false ? 'checked' : '') + ' onchange="toggleMenuItemStatus(' + index + ', this.checked)"><span class="slider-toggle"></span></label> ' +
            '<span style="font-size:0.8rem; margin-right:6px; color:' + (item.isAvailable !== false ? 'var(--neon-green)' : 'var(--neon-red)') + '">' + (item.isAvailable !== false ? 'متوفر' : 'نفد اليوم') + '</span></td>' +
            '<td><button class="btn-action-top" style="height:28px; padding:0 8px;" onclick="promptEditPrice(' + index + ')"><i class="fas fa-edit"></i> تعديل</button></td>';
        tbody.appendChild(tr);
    });
}

async function toggleMenuItemStatus(index, isAvailable) {
    liveMenuItems[index].isAvailable = isAvailable;
    await db.collection('settings').doc('menu_data').update({ items: liveMenuItems });
    showInteractiveToast('order', 'تحديث المنيو', 'تم ' + (isAvailable ? 'تفعيل' : 'إيقاف') + ' صنف (' + liveMenuItems[index].name + ')');
}

async function promptEditPrice(index) {
    const newPrice = prompt('أدخل السعر الجديد لصنف (' + liveMenuItems[index].name + '):', liveMenuItems[index].price);
    if (newPrice && !isNaN(newPrice)) {
        liveMenuItems[index].price = Number(newPrice);
        await db.collection('settings').doc('menu_data').update({ items: liveMenuItems });
        renderMenuManagerTable();
    }
}
