/* =====================================================================
   EduNova — Student Platform shared module
   - Same Firebase project as the existing exam pages
   - Session keys are the SAME ones welcome/exam/result already read
     (studentId, studentName, studentCode, studentUsername, studentSessionToken)
   ===================================================================== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  addDoc,
  query,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB6_HkPcbAhyZG8joikJr_kPK-6UACxldg",
  authDomain: "plat-form-97b8d.firebaseapp.com",
  projectId: "plat-form-97b8d",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export { collection, getDocs, doc, getDoc, setDoc, addDoc, query, where, serverTimestamp };

/* ================= SESSION ================= */
export const SESSION_KEYS = [
  "studentId", "studentName", "studentCode",
  "studentUsername", "studentSessionToken", "studentPhone"
];

export function getStudent() {
  const id = localStorage.getItem("studentId");
  if (!id) return null;
  return {
    id,
    name: localStorage.getItem("studentName") || "",
    code: localStorage.getItem("studentCode") || "",
    username: localStorage.getItem("studentUsername") || "",
    phone: localStorage.getItem("studentPhone") || ""
  };
}

export function requireStudent() {
  const s = getStudent();
  if (!s) {
    window.location.replace("login.html");
    return null;
  }
  return s;
}

export function logout() {
  SESSION_KEYS.forEach(k => localStorage.removeItem(k));
  window.location.href = "index.html";
}

/* Creates a fresh session for a student document (used by login + signup).
   The sessionToken is what exam.html sends along with essay submissions,
   so it is regenerated on every login exactly like the old login page did. */
export async function startSession(studentId, student) {
  const sessionToken =
    (crypto?.randomUUID && crypto.randomUUID()) ||
    (Date.now().toString(36) + Math.random().toString(36).slice(2));

  localStorage.setItem("studentId", studentId);
  localStorage.setItem("studentName", student.name || "");
  localStorage.setItem("studentCode", student.code || "");
  localStorage.setItem("studentUsername", student.username || "");
  localStorage.setItem("studentPhone", student.phone || "");
  localStorage.setItem("studentSessionToken", sessionToken);

  await setDoc(
    doc(db, "students", studentId, "meta", "login"),
    { used: true, time: Date.now(), sessionToken }
  );
}

/* ================= TEXT / PHONE HELPERS ================= */
export function escapeHtml(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function toLatinDigits(str) {
  return String(str || "")
    .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
    .replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d));
}

/* Returns an E.164 number ("+201012345678") or null when it is not valid.
   Egyptian mobiles can be typed as 01012345678, 1012345678, +201012345678 or 00201012345678.
   Any other country must be typed with +countrycode. */
export function normalizePhone(input) {
  let s = toLatinDigits(input).trim().replace(/[\s\-().]/g, "");
  if (!s) return null;

  let international = false;
  if (s.startsWith("+")) { international = true; s = s.slice(1); }
  else if (s.startsWith("00")) { international = true; s = s.slice(2); }

  if (!/^\d+$/.test(s)) return null;

  if (!international) {
    if (/^01[0125]\d{8}$/.test(s)) return "+20" + s.slice(1);
    if (/^1[0125]\d{8}$/.test(s)) return "+20" + s;
    if (/^201[0125]\d{8}$/.test(s)) return "+" + s;
    return null;
  }

  if (s.startsWith("20")) return /^201[0125]\d{8}$/.test(s) ? "+" + s : null;
  return (/^[1-9]\d{7,14}$/.test(s)) ? "+" + s : null;
}

export function looksLikePhone(input) {
  const s = toLatinDigits(input).trim();
  return /^[+\d\s\-().]+$/.test(s) && s.replace(/\D/g, "").length >= 8;
}

export async function isPhoneTaken(phone) {
  const snap = await getDocs(query(collection(db, "students"), where("phone", "==", phone)));
  return !snap.empty;
}

/* ================= PASSWORD ================= */
function toHex(buffer) {
  return [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export function randomSalt() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return toHex(a);
}

export async function hashPassword(password, salt) {
  const data = new TextEncoder().encode(salt + ":" + password);
  return toHex(await crypto.subtle.digest("SHA-256", data));
}

/* Accounts created by the admin have a plain `password` field (unchanged);
   accounts created by students themselves store a salted hash instead. */
export async function checkPassword(student, password) {
  if (student.passwordHash) {
    return (await hashPassword(password, student.passwordSalt || "")) === student.passwordHash;
  }
  return student.password === password;
}

/* ================= USERNAME / CODE (same scheme the admin uses) ================= */
export const RESERVED_USERNAMES = [
  "admin", "administrator", "superadmin", "root", "system",
  "moderator", "owner", "teacher", "manager",
  "مدير", "ادمن", "أدمن", "الادمن", "الأدمن"
];

export function isReservedUsername(username) {
  return RESERVED_USERNAMES.includes(String(username || "").trim().toLowerCase());
}

const ARABIC_TO_LATIN = {
  "ا":"a","أ":"a","إ":"a","آ":"a","ب":"b","ت":"t","ث":"th","ج":"g","ح":"h",
  "خ":"kh","د":"d","ذ":"th","ر":"r","ز":"z","س":"s","ش":"sh","ص":"s","ض":"d",
  "ط":"t","ظ":"z","ع":"a","غ":"gh","ف":"f","ق":"k","ك":"k","ل":"l","م":"m",
  "ن":"n","ه":"h","و":"w","ي":"y","ى":"a","ة":"a","ء":"","ئ":"y","ؤ":"w"
};

function transliterateName(name) {
  const firstWord = String(name || "").trim().split(/\s+/)[0] || "";
  let out = "";
  for (const ch of firstWord.toLowerCase()) {
    if (/[a-z0-9]/.test(ch)) out += ch;
    else if (ARABIC_TO_LATIN[ch] !== undefined) out += ARABIC_TO_LATIN[ch];
  }
  return out.slice(0, 12);
}

function randomUsername(name) {
  const base = transliterateName(name) || "student";
  let username = `${base}${Math.floor(100 + Math.random() * 900)}`;
  if (isReservedUsername(username)) username = `st${username}`;
  return username;
}

export async function generateUniqueUsername(name) {
  for (let i = 0; i < 20; i++) {
    const username = randomUsername(name);
    const snap = await getDocs(query(collection(db, "students"), where("username", "==", username)));
    if (snap.empty && !isReservedUsername(username)) return username;
  }
  throw new Error("تعذر توليد اسم مستخدم فريد، حاول مرة أخرى");
}

export async function generateUniqueCode() {
  for (let i = 0; i < 20; i++) {
    const code = `EN-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const snap = await getDocs(query(collection(db, "students"), where("code", "==", code)));
    if (snap.empty) return code;
  }
  throw new Error("تعذر توليد كود فريد، حاول مرة أخرى");
}

/* ================= EXAMS ================= */
export async function fetchExams() {
  const snap = await getDocs(collection(db, "exams"));
  const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  // newest first; exams without createdAt go last
  list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  return list;
}

/* Only allow http(s) image URLs coming from the database into <img src> */
export function safeImageUrl(url) {
  return /^https?:\/\//i.test(String(url || "")) ? url : "";
}

/* ================= NAVBAR ================= */
export function renderNav(active) {
  const el = document.getElementById("nav");
  if (!el) return;
  const student = getStudent();

  const links = student
    ? `
      <a class="nav-link ${active === "home" ? "active" : ""}" href="home.html">الرئيسية</a>
      <a class="nav-link ${active === "account" ? "active" : ""}" href="account.html">حسابي</a>
      <button class="nav-link" id="navLogout" type="button">خروج</button>`
    : `
      <a class="nav-link ${active === "login" ? "active" : ""}" href="login.html">تسجيل الدخول</a>
      <a class="nav-link cta" href="signup.html">إنشاء حساب</a>`;

  el.innerHTML = `
    <a class="brand" href="${student ? "home.html" : "index.html"}" aria-label="EduNova">
      <img src="icon.png" alt="EduNova">
      <div>
        <h2>EduNova</h2>
        <span>Developed By Abdelrahman Mohamed</span>
      </div>
    </a>
    <nav class="nav-links">${links}</nav>`;

  const out = document.getElementById("navLogout");
  if (out) out.onclick = logout;
}

/* ================= MODALS ================= */
function ensureModals() {
  if (document.getElementById("pfLoading")) return;
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <div class="modal" id="pfLoading">
      <div class="modal-box glass">
        <img src="icon.png" class="loading-logo" alt="">
        <h2 id="pfLoadingTitle">لحظة واحدة بس... ⏳</h2>
        <div class="wave-loader"><span></span><span></span><span></span><span></span><span></span></div>
      </div>
    </div>
    <div class="modal" id="pfPopup">
      <div class="modal-box glass">
        <div class="icon" id="pfPopupIcon">⚠️</div>
        <h2 id="pfPopupTitle"></h2>
        <p id="pfPopupMsg"></p>
        <button class="btn btn-primary" id="pfPopupBtn" type="button">تمام ✅</button>
      </div>
    </div>`;
  document.body.append(...wrap.children);
}

export function showLoading(text) {
  ensureModals();
  document.getElementById("pfLoadingTitle").innerText = text || "لحظة واحدة بس... ⏳";
  document.getElementById("pfLoading").classList.add("show");
}
export function hideLoading() {
  const m = document.getElementById("pfLoading");
  if (m) m.classList.remove("show");
}

export function showPopup(icon, title, message, onClose) {
  ensureModals();
  document.getElementById("pfPopupIcon").innerText = icon;
  document.getElementById("pfPopupTitle").innerText = title;
  document.getElementById("pfPopupMsg").innerText = message;
  const popup = document.getElementById("pfPopup");
  popup.classList.add("show");
  document.getElementById("pfPopupBtn").onclick = () => {
    popup.classList.remove("show");
    if (onClose) onClose();
  };
}
