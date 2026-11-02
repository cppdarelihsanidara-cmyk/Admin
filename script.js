document.documentElement.classList.add('js');

/* T (نصوص الموقع) انتقلت إلى i18n-data.js وتُحمَّل قبل هذا الملف */
/* حماية كاملة من XSS (Rule 2): لا innerHTML إطلاقًا — بناء DOM آمن عبر createElement و textContent و createElementNS */

let L = 'ar';
let posts = [];

try {
  localStorage.setItem('lang', 'ar');
} catch (error) {
  // ignore storage errors in restricted contexts
}

function createIcon(name) {
  const safeName = String(name || '').replace(/[^a-zA-Z0-9_-]/g, '');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'i');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', '#i-' + safeName);
  svg.appendChild(use);
  return svg;
}

function splitWelcomeWords() {
  const title = document.querySelector('.welcome-title');
  if (!title) return;

  const text = title.textContent.trim();
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return;

  title.textContent = '';
  words.forEach((word, index) => {
    if (index > 0) title.appendChild(document.createTextNode(' '));
    const span = document.createElement('span');
    span.className = 'word';
    span.style.setProperty('--i', String(index));
    span.textContent = word;
    title.appendChild(span);
  });
}

function updateI18n() {
  document.documentElement.lang = L;
  document.documentElement.dir = L === 'ar' ? 'rtl' : 'ltr';

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    if (T[L] && T[L][key]) {
      el.textContent = T[L][key];
    }
  });

  splitWelcomeWords();

  const langLabel = L === 'ar' ? 'Français' : 'العربية';
  const langButton = document.getElementById('langTxt');
  if (langButton) langButton.textContent = langLabel;

  document.title = (T[L].h1 || T[L].heroTitle) + ' – ' + (T[L].f2 || T[L].brand);

  try {
    localStorage.setItem('lang', L);
  } catch (error) {
    // ignore storage errors in restricted contexts
  }
}

function renderNews() {
  const newsGrid = document.getElementById('newsGrid');
  if (!newsGrid) return;

  newsGrid.textContent = '';
  if (!posts.length) {
    return;
  }

  // بناء آمن: لا innerHTML ولا إدراج نصوص/روابط قادمة من مصدر خارجي (حماية من XSS)
  const safeHttps = (u) => { try { const x = new URL(u, location.href); return x.protocol === 'https:' ? x.href : ''; } catch (e) { return ''; } };
  posts.forEach((p) => {
    const date = new Date(p.date).toLocaleDateString(L === 'ar' ? 'ar-DZ-u-nu-latn' : 'fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const card = document.createElement('article');
    card.className = 'card in';
    const ph = document.createElement('div');
    ph.className = 'ph';
    const imgSrc = safeHttps(p.image);
    if (imgSrc) {
      const img = document.createElement('img');
      img.src = imgSrc; img.alt = ''; img.loading = 'lazy';
      img.addEventListener('error', () => img.remove());
      ph.appendChild(img);
    }
    const body = document.createElement('div');
    body.className = 'body';
    const d = document.createElement('span'); d.className = 'date'; d.textContent = date;
    const t = document.createElement('h3'); t.textContent = (p.title && p.title[L]) || '';
    const tx = document.createElement('p'); tx.textContent = (p.text && p.text[L]) || '';
    const a = document.createElement('a'); a.className = 'btn'; a.href = safeHttps(p.url) || '#';
    const sp = document.createElement('span'); sp.textContent = T[L].more;
    const ar = document.createElement('i'); ar.className = 'arr'; ar.appendChild(createIcon('arrow'));
    a.append(sp, ar);
    body.append(d, t, tx, a);
    card.append(ph, body);
    newsGrid.appendChild(card);
  });
}

function setLang(lang) {
  L = lang;
  updateI18n();
  renderNews();
}

const io = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in');
      io.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('[data-i]').forEach((el) => {
  el.textContent = '';
  el.appendChild(createIcon(el.dataset.i));
});

document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

document.getElementById('lang')?.addEventListener('click', () => {
  setLang(L === 'ar' ? 'fr' : 'ar');
});

const navToggle = document.querySelector('.nav-toggle');
const nav = document.querySelector('.main-nav');

if (navToggle && nav) {
  navToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = nav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      nav.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });

  document.addEventListener('click', (e) => {
    if (nav.classList.contains('open') && !nav.contains(e.target) && !navToggle.contains(e.target)) {
      nav.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    }
  });
}

updateI18n();


/* ═══════════════════════════════════════════════════════════════════
   DAR EL IHSAN — REGISTRATION REQUESTS & PUBLIC INQUIRIES CLIENT
   ═══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var regModal = document.getElementById('regModal');
  var inqModal = document.getElementById('inqModal');
  var btnHeroReg = document.getElementById('btnHeroReg');
  var btnHeroInq = document.getElementById('btnHeroInq');
  var navBtnReg = document.getElementById('navBtnReg');
  var navBtnInq = document.getElementById('navBtnInq');

  var btnCloseRegModal = document.getElementById('btnCloseRegModal');
  var btnCancelReg = document.getElementById('btnCancelReg');
  var btnCloseInqModal = document.getElementById('btnCloseInqModal');
  var btnCancelInq = document.getElementById('btnCancelInq');

  var regForm = document.getElementById('regForm');
  var inqForm = document.getElementById('inqForm');
  var regSuccessCard = document.getElementById('regSuccessCard');
  var inqSuccessCard = document.getElementById('inqSuccessCard');

  var regChildDob = document.getElementById('reg_child_dob');
  var regChildAge = document.getElementById('reg_child_age');
  var regAlertBox = document.getElementById('regAlertBox');
  var inqAlertBox = document.getElementById('inqAlertBox');

  function openReg() {
    var rm = document.getElementById('regModal') || regModal;
    if (!rm) return;
    rm.hidden = false;
    rm.removeAttribute('hidden');
    rm.style.display = 'flex';
    var rf = document.getElementById('regForm') || regForm;
    var sc = document.getElementById('regSuccessCard') || regSuccessCard;
    var ab = document.getElementById('regAlertBox') || regAlertBox;
    var age = document.getElementById('reg_child_age') || regChildAge;
    if (rf) { rf.hidden = false; rf.removeAttribute('hidden'); rf.style.display = 'block'; rf.reset(); }
    if (sc) { sc.hidden = true; sc.setAttribute('hidden', ''); sc.style.display = 'none'; }
    if (ab) { ab.hidden = true; ab.setAttribute('hidden', ''); ab.style.display = 'none'; }
    if (age) age.value = '';
    document.body.style.overflow = 'hidden';
  }

  function closeReg() {
    var rm = document.getElementById('regModal') || regModal;
    if (!rm) return;
    rm.hidden = true;
    rm.setAttribute('hidden', '');
    rm.style.display = 'none';
    document.body.style.overflow = '';
  }

  function openInq() {
    var im = document.getElementById('inqModal') || inqModal;
    if (!im) return;
    im.hidden = false;
    im.removeAttribute('hidden');
    im.style.display = 'flex';
    var inf = document.getElementById('inqForm') || inqForm;
    var sc = document.getElementById('inqSuccessCard') || inqSuccessCard;
    var ab = document.getElementById('inqAlertBox') || inqAlertBox;
    if (inf) { inf.hidden = false; inf.removeAttribute('hidden'); inf.style.display = 'block'; inf.reset(); }
    if (sc) { sc.hidden = true; sc.setAttribute('hidden', ''); sc.style.display = 'none'; }
    if (ab) { ab.hidden = true; ab.setAttribute('hidden', ''); ab.style.display = 'none'; }
    document.body.style.overflow = 'hidden';
  }

  function closeInq() {
    var im = document.getElementById('inqModal') || inqModal;
    if (!im) return;
    im.hidden = true;
    im.setAttribute('hidden', '');
    im.style.display = 'none';
    document.body.style.overflow = '';
  }

  // Global exposure for immediate click access
  window.openRegModal = openReg;
  window.closeRegModal = closeReg;
  window.openInqModal = openInq;
  window.closeInqModal = closeInq;

  if (btnHeroReg) btnHeroReg.addEventListener('click', openReg);
  var btnBottomReg = document.getElementById('btnBottomReg');
  var btnBottomInq = document.getElementById('btnBottomInq');
  if (btnBottomReg) btnBottomReg.addEventListener('click', openReg);
  if (btnBottomInq) btnBottomInq.addEventListener('click', openInq);

  if (btnHeroInq) btnHeroInq.addEventListener('click', openInq);
  if (navBtnReg) navBtnReg.addEventListener('click', function (e) { e.preventDefault(); openReg(); });
  if (navBtnInq) navBtnInq.addEventListener('click', function (e) { e.preventDefault(); openInq(); });

  if (btnCloseRegModal) btnCloseRegModal.addEventListener('click', closeReg);
  if (btnCancelReg) btnCancelReg.addEventListener('click', closeReg);
  if (btnCloseInqModal) btnCloseInqModal.addEventListener('click', closeInq);
  if (btnCancelInq) btnCancelInq.addEventListener('click', closeInq);

  var btnDoneReg = document.getElementById('btnDoneReg');
  if (btnDoneReg) btnDoneReg.addEventListener('click', closeReg);
  var btnDoneInq = document.getElementById('btnDoneInq');
  if (btnDoneInq) btnDoneInq.addEventListener('click', closeInq);

  if (regModal) {
    regModal.addEventListener('click', function (e) {
      if (e.target === regModal) closeReg();
    });
  }
  if (inqModal) {
    inqModal.addEventListener('click', function (e) {
      if (e.target === inqModal) closeInq();
    });
  }

  // حساب العمر تلقائياً فور إدخال تاريخ الميلاد
  if (regChildDob && regChildAge) {
    regChildDob.addEventListener('input', function () {
      var val = regChildDob.value;
      if (!val) { regChildAge.value = ''; return; }
      try {
        var birth = new Date(val);
        var today = new Date();
        var age = today.getFullYear() - birth.getFullYear();
        var m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
        if (age >= 0 && !isNaN(age)) {
          regChildAge.value = age + ' سنة (' + (age < 3 ? 'مرحلة التدخل المبكر' : (age < 6 ? 'ما قبل التمدرس' : (age < 15 ? 'سن التمدرس' : 'سن التأهيل والتمهين'))) + ')';
        } else {
          regChildAge.value = 'تاريخ غير صالح';
        }
      } catch (e) {
        regChildAge.value = '';
      }
    });
  }

  // إرسال طلب التسجيل إلى خادم Supabase
  if (regForm) {
    regForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (regAlertBox) regAlertBox.hidden = true;

      // فحص Honeypot للحماية من السبام
      var hp = regForm.querySelector('input[name="website_url_check"]');
      if (hp && hp.value) return; // Silent discard for bot

      var gName = document.getElementById('reg_guardian_name').value.trim();
      var gPhone = document.getElementById('reg_guardian_phone').value.trim();
      var gEmail = document.getElementById('reg_guardian_email').value.trim();
      var residence = document.getElementById('reg_residence').value.trim();
      var cName = document.getElementById('reg_child_name').value.trim();
      var cDob = document.getElementById('reg_child_dob').value;
      var disType = (document.getElementById('reg_disability') ? document.getElementById('reg_disability').value.trim() : '');
      var extra = document.getElementById('reg_extra_info').value.trim();
      var consent = document.getElementById('reg_consent').checked;

      if (!gName || !gPhone || !residence || !cName || !cDob || !disType) {
        if (regAlertBox) {
          regAlertBox.textContent = 'يرجى ملء جميع الحقول الإلزامية المطلوبة (*).';
          regAlertBox.className = 'form-alert is-err';
          regAlertBox.hidden = false;
        }
        return;
      }

      if (!consent) {
        if (regAlertBox) {
          regAlertBox.textContent = 'يجب الموافقة على إشعار الخصوصية وشروط دراسة الطلب للمتابعة.';
          regAlertBox.className = 'form-alert is-err';
          regAlertBox.hidden = false;
        }
        return;
      }

      var btnSubmit = document.getElementById('btnSubmitReg');
      if (btnSubmit) { btnSubmit.disabled = true; btnSubmit.textContent = 'جارٍ إرسال الطلب…'; }

      // توليد رقم مرجعي آمن
      var randomCode = 'REQ-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000);

      var payload = {
        reference_code: randomCode,
        guardian_name: gName,
        guardian_phone: gPhone,
        guardian_email: gEmail,
        residence_wilaya: 'غرداية',
        residence_commune: residence,
        child_name: cName,
        child_birth_date: cDob,
        disability_type: disType,
        additional_information: extra,
        status: 'new',
        privacy_consent: true,
        created_at: new Date().toISOString()
      };

      try {
        var cfg = (window.DE_CONFIG) || {
          supabaseUrl: 'https://qgjddtylriqdwvpihvmi.supabase.co',
          supabaseKey: 'sb_publishable_8mgO37k9jB9_Dg4OQTfynw_NBC0gLjK'
        };

        var res = await fetch(cfg.supabaseUrl + '/rest/v1/registration_requests', {
          method: 'POST',
          headers: {
            'apikey': cfg.supabaseKey,
            'Authorization': 'Bearer ' + cfg.supabaseKey,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify(payload)
        });

        // حفظ محلي احتياطي
        try {
          var curLocal = JSON.parse(localStorage.getItem('de_local_reg_requests') || '[]');
          curLocal.unshift(payload);
          localStorage.setItem('de_local_reg_requests', JSON.stringify(curLocal));
        } catch (eStorage) {}

        regForm.hidden = true;
        var displayEl = document.getElementById('regRefCodeDisplay');
        if (displayEl) displayEl.textContent = randomCode;
        if (regSuccessCard) regSuccessCard.hidden = false;

      } catch (err) {
        if (regAlertBox) {
          regAlertBox.textContent = 'حدث خطأ في الاتصال، يرجى المحاولة لاحقاً أو الاتصال المباشر بإدارة المركز.';
          regAlertBox.className = 'form-alert is-err';
          regAlertBox.hidden = false;
        }
      } finally {
        if (btnSubmit) { btnSubmit.disabled = false; btnSubmit.textContent = 'إرسال طلب التسجيل'; }
      }
    });
  }

  // إرسال استفسار عام
  if (inqForm) {
    inqForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (inqAlertBox) inqAlertBox.hidden = true;

      var hp = inqForm.querySelector('input[name="inq_honeypot_field"]');
      if (hp && hp.value) return;

      var name = document.getElementById('inq_name').value.trim();
      var phone = document.getElementById('inq_phone').value.trim();
      var email = document.getElementById('inq_email').value.trim();
      var subject = document.getElementById('inq_subject').value.trim();
      var message = document.getElementById('inq_message').value.trim();
      var consent = document.getElementById('inq_consent').checked;

      if (!name || !phone || !subject || !message) {
        if (inqAlertBox) {
          inqAlertBox.textContent = 'يرجى ملء جميع الحقول المطلوبة (*).';
          inqAlertBox.className = 'form-alert is-err';
          inqAlertBox.hidden = false;
        }
        return;
      }

      var btnSubmit = document.getElementById('btnSubmitInq');
      if (btnSubmit) { btnSubmit.disabled = true; btnSubmit.textContent = 'جارٍ إرسال الاستفسار…'; }

      var payload = {
        name: name,
        phone: phone,
        email: email,
        subject: subject,
        message: message,
        status: 'new',
        privacy_consent: consent,
        created_at: new Date().toISOString()
      };

      try {
        var cfg = (window.DE_CONFIG) || {
          supabaseUrl: 'https://qgjddtylriqdwvpihvmi.supabase.co',
          supabaseKey: 'sb_publishable_8mgO37k9jB9_Dg4OQTfynw_NBC0gLjK'
        };

        await fetch(cfg.supabaseUrl + '/rest/v1/public_inquiries', {
          method: 'POST',
          headers: {
            'apikey': cfg.supabaseKey,
            'Authorization': 'Bearer ' + cfg.supabaseKey,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify(payload)
        });

        try {
          var curLocalInq = JSON.parse(localStorage.getItem('de_local_inquiries') || '[]');
          curLocalInq.unshift(payload);
          localStorage.setItem('de_local_inquiries', JSON.stringify(curLocalInq));
        } catch (eStorage) {}

        inqForm.hidden = true;
        if (inqSuccessCard) inqSuccessCard.hidden = false;

      } catch (err) {
        if (inqAlertBox) {
          inqAlertBox.textContent = 'تعذر إرسال الاستفسار حالياً، يرجى المحاولة مجدداً.';
          inqAlertBox.className = 'form-alert is-err';
          inqAlertBox.hidden = false;
        }
      } finally {
        if (btnSubmit) { btnSubmit.disabled = false; btnSubmit.textContent = 'إرسال الاستفسار'; }
      }
    });
  }
})();
