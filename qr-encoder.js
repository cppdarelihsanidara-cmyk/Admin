/* واجهة توافق: card.js يبحث عن DEQR. المولّد الفعلي موجود في qr-gen.js (DE_QR). */
(function (root) {
  'use strict';
  if (!root.DEQR && root.DE_QR) root.DEQR = root.DE_QR;
})(window);
