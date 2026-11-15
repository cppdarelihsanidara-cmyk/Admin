/* حماية من التضمين داخل إطار (Clickjacking).
   GitHub Pages لا يدعم رؤوس HTTP، وتوجيه frame-ancestors داخل <meta> يتجاهله المتصفح،
   لذلك نمنع التضمين برمجياً: إن حُمّلت الصفحة داخل iframe نُخفيها ونخرج منها. */
(function () {
  'use strict';
  try {
    if (window.self !== window.top) {
      document.documentElement.style.display = 'none';
      try { window.top.location.href = window.self.location.href; } catch (e) {}
    }
  } catch (e) { document.documentElement.style.display = 'none'; }
})();
