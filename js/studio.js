db.collection('settings').doc('studio_design').onSnapshot((doc) => {
    if (doc.exists) {
        const d = doc.data();
        if (d.announcementText) {
            const input = document.getElementById('studio-announcement-input');
            if (input) input.value = d.announcementText;
        }
    }
});

async function saveStudioAnnouncement() {
    const txt = document.getElementById('studio-announcement-input').value.trim();
    await db.collection('settings').doc('studio_design').set({
        announcementText: txt,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    showInteractiveToast('order', 'استوديو التصميم', 'تم تحديث ونشر بانر الإعلانات في شاشة الزبون!');
    refreshStudioPreview();
}

function refreshStudioPreview() {
    const iframe = document.getElementById('studio-preview-iframe');
    if (iframe) iframe.src = iframe.src;
}
