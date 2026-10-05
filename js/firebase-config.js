const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null };
const firebaseConfig = {
    apiKey: "AIzaSyA4WbVCVKdmxIM0gNqvAuOUVhZx9T_tsU4",
    authDomain: "fly-chicken-pos.firebaseapp.com",
    projectId: "fly-chicken-pos",
    storageBucket: "fly-chicken-pos.firebasestorage.app",
    messagingSenderId: "258793387159",
    appId: "1:258793387159:web:9494fc219d04cad27be5d2",
    measurementId: "G-P9CPG4Q0FE"
};
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let soundEnabled = true;
let audioCtx = null;
function unlockAudioSystem() {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const banner = document.getElementById('audio-unlock-banner');
        if (banner) banner.style.display = 'none';
        playBeep(600, 0.1);
    } catch(e) {}
}
window.addEventListener('click', () => unlockAudioSystem(), { once: true });

function playBeep(freq, duration, type = 'triangle') {
    if (!soundEnabled) return;
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + duration);
    } catch(e) {}
}
function playOrderChime() { playBeep(520, 0.25); setTimeout(() => playBeep(880, 0.45), 150); }
function playCancelChime() { playBeep(440, 0.2, 'sawtooth'); setTimeout(() => playBeep(220, 0.35, 'sawtooth'), 160); }
function playChatChime() { playBeep(600, 0.15, 'sine'); setTimeout(() => playBeep(900, 0.25, 'sine'), 120); }
function toggleSound() {
    soundEnabled = !soundEnabled;
    document.getElementById('sound-btn').innerHTML = soundEnabled ? '<i class="fas fa-volume-up"></i>' : '<i class="fas fa-volume-mute" style="color:var(--danger);"></i>';
}
function showInteractiveToast(type, title, desc, onClickAction) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast-card ' + type + '-toast';
    toast.innerHTML = '<div class="toast-icon"><i class="' + (type === 'chat' ? 'fab fa-whatsapp' : type === 'cancel' ? 'fas fa-ban' : 'fas fa-utensils') + '"></i></div>' +
        '<div class="toast-info"><div class="toast-title"><span>' + escapeHTML(title) + '</span><span style="font-size:0.75rem; color:var(--text-muted);">الآن</span></div><div class="toast-desc">' + escapeHTML(desc) + '</div></div>';
    toast.onclick = () => { if (onClickAction) onClickAction(); toast.remove(); };
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 6000);
}
function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
function formatOrderNum(order) {
    if (!order) return '000';
    if (order.orderNum) return String(order.orderNum).padStart(3, '0').slice(-3);
    const digits = String(order.id || '').replace(/\D/g, '');
    if (digits.length >= 3) return digits.slice(-3);
    if (digits.length > 0) return digits.padStart(3, '0');
    let hash = 0;
    const str = String(order.id || order._docId || '101');
    for (let i = 0; i < str.length; i++) hash = ((hash << 5) - hash) + str.charCodeAt(i);
    return String(Math.abs(hash) % 900 + 100);
}
function getSafeTime(val) {
    if (!val) return 0;
    if (typeof val.toDate === 'function') {
        try { return val.toDate().getTime(); } catch(e) { return 0; }
    }
    if (val.seconds) return val.seconds * 1000;
    const d = new Date(val);
    return isNaN(d.getTime()) ? 0 : d.getTime();
}
function switchMainView(viewId, element) {
    document.querySelectorAll('.view-content').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-pills .nav-pill').forEach(b => b.classList.remove('active'));
    const target = document.getElementById('view-' + viewId);
    if (target) target.classList.add('active');
    if (element) element.classList.add('active');
    if (viewId === 'sales' && typeof loadShiftReport === 'function') loadShiftReport('today');
    if (viewId === 'customers' && typeof renderCustomerCRM === 'function') renderCustomerCRM();
    if (viewId === 'chat' && typeof renderChatHub === 'function') { renderChatHub(); if (!activeChatOrderId && allOrders.length > 0) selectChatThread(allOrders[0]); }
    if (viewId === 'studio' && typeof renderMenuManagerTable === 'function') { renderMenuManagerTable(); }
}
function closeModal(id) { const m = document.getElementById(id); if (m) m.classList.remove('active'); }
