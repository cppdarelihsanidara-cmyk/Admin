/* زر/إيماءة الرجوع داخل فضاء الأولياء (PWA): يعيد للصفحة السابقة بدل الخروج من التطبيق. */
(function (root) {
  'use strict';
  var doc = root.document;
  function goBack() {
    if (root.history.length > 1) root.history.back();
    else root.location.href = './parent.html';
  }
  root.DE_NAV = { back: goBack };
  doc.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-nav-back]');
    if (t) { e.preventDefault(); goBack(); }
  });
})(window);
