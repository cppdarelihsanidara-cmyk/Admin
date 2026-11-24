/* card.js — بطاقة انخراط المنخرط الرسمية (85.6 × 54 مم أفقية) بدقة 300 dpi على Canvas.
   العناصر المعتمدة: الشعار الأصلي لدار الإحسان، العنوان الرسمي، رقم التسجيل المجرد (بدون N°)،
   الاسم واللقب، تاريخ الميلاد، اختصار الإعاقة (TSA / T21 / R.M)، بيانات الدخول، ورمز QR ديناميكي.
   مستبعد من البطاقة: حقلا الفرع والقسم (Branch / Section). */
(function (root) {
  'use strict';

  var W = 1011, H = 638;
  var NAVY = '#0C2D55', GOLD = '#C9A449', INK = '#0F172A', MUTED = '#475569', LINE = '#CBD5E1';
  var FONT = 'IBM Plex Sans Arabic, "Segoe UI", Tahoma, sans-serif';

  function dateLabel(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    return m ? m[3] + '/' + m[2] + '/' + m[1] : '—';
  }

  function memberLabel(n) {
    var s = n == null ? '' : String(n).trim();
    s = s.replace(/^N°\s*/i, '').trim();
    return s || '—';
  }

  function disabilityCode(raw) {
    var s = String(raw || '').trim();
    if (!s) return '—';
    var upper = s.toUpperCase();
    if (/\bTSA\b/.test(upper) || s.indexOf('توحد') >= 0) return 'TSA';
    if (/T\.?\s*21/.test(upper) || s.indexOf('داون') >= 0) return 'T21';
    if (/R\.?\s*M\.?/.test(upper) || s.indexOf('تأخر ذهني') >= 0) return 'R.M';
    if (s.indexOf('متعدد') >= 0) return 'POLY';
    if (s.indexOf('دراسي') >= 0) return 'TD';
    return s.length <= 10 ? s : s.slice(0, 10);
  }

  function loadImage(src) {
    return new Promise(function (res) {
      var img = new Image();
      img.onload = function () { res(img); };
      img.onerror = function () { res(null); };
      img.src = src;
    });
  }

  function wrap(ctx, text, maxW, maxLines) {
    var words = String(text || '').split(/\s+/).filter(Boolean), lines = [], cur = '';
    words.forEach(function (w) {
      var t = cur ? cur + ' ' + w : w;
      if (ctx.measureText(t).width <= maxW || !cur) cur = t;
      else { lines.push(cur); cur = w; }
    });
    if (cur) lines.push(cur);
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      var last = lines[maxLines - 1];
      while (ctx.measureText(last + '…').width > maxW && last.length > 1) last = last.slice(0, -1);
      lines[maxLines - 1] = last + '…';
    }
    return lines;
  }

  function fitFont(ctx, text, weight, startPx, maxW) {
    var px = startPx;
    ctx.font = weight + ' ' + px + 'px ' + FONT;
    while (ctx.measureText(text).width > maxW && px > 18) { px -= 2; ctx.font = weight + ' ' + px + 'px ' + FONT; }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function drawQr(ctx, text, x, y, box) {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, box, box);
    if (root.DE_QR && typeof root.DE_QR.drawToCanvas === 'function') {
      try {
        var tempCanvas = (typeof document !== 'undefined') ? document.createElement('canvas') : null;
        if (tempCanvas) {
          root.DE_QR.drawToCanvas(tempCanvas, text, { size: box, margin: 4, dark: '#000000', light: '#ffffff' });
          ctx.drawImage(tempCanvas, x, y, box, box);
          return;
        }
      } catch (e1) {}
    }
    var enc = root.DEQR || (root.DE_QR && root.DE_QR.encode ? root.DE_QR : null);
    if (enc && typeof enc.encode === 'function') {
      try {
        var q = enc.encode(text), total = q.size + 8;
        var m = Math.floor(box / total), side = m * total;
        var ox = x + Math.floor((box - side) / 2), oy = y + Math.floor((box - side) / 2);
        ctx.fillStyle = '#000000';
        for (var r = 0; r < q.size; r++) for (var c = 0; c < q.size; c++) {
          if (q.dark(c, r)) ctx.fillRect(ox + (c + 4) * m, oy + (r + 4) * m, m, m);
        }
        return;
      } catch (e2) {}
    }
    ctx.fillStyle = NAVY; ctx.font = '700 18px ' + FONT; ctx.textAlign = 'center';
    ctx.fillText('QR', x + box / 2, y + box / 2);
  }

  function fontsReady() {
    if (!(document.fonts && document.fonts.load)) return Promise.resolve();
    return Promise.all([
      document.fonts.load('800 38px IBM Plex Sans Arabic'),
      document.fonts.load('700 24px IBM Plex Sans Arabic'),
      document.fonts.load('400 22px IBM Plex Sans Arabic')
    ]).catch(function () {});
  }

  function checkUrl(u) {
    if (!u) return 'https://cppdarelihsanidara-cmyk.github.io/Parents/parent.html';
    try {
      var x = new URL(u, (typeof window !== 'undefined' && window.location) ? window.location.href : 'https://cppdarelihsanidara-cmyk.github.io/Parents/');
      return x.href;
    } catch (e) { return String(u); }
  }

  function render(info) {
    return Promise.resolve().then(function () {
      if (!info || !info.url) throw new Error('رابط البطاقة مفقود.');
      var url = checkUrl(info.url);
      var officialTitle = 'المركز النفسي البيداغوجي لذوي الاحتياجات الخاصة دار الإحسان';
      return fontsReady().then(function () {
        return loadImage('logo-sq.png').then(function (lg) { return lg || loadImage('logo.png'); });
      }).then(function (logo) {
        var cv = document.createElement('canvas');
        cv.width = W; cv.height = H;
        var ctx = cv.getContext('2d');
        ctx.direction = 'rtl';
        ctx.textBaseline = 'alphabetic';

        // خلفية بيضاء وترويسة رسمية
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = NAVY; ctx.fillRect(0, 0, W, 142);
        ctx.fillStyle = GOLD; ctx.fillRect(0, 142, W, 7);

        // علامة مائية خفيفة للشعار في الوسط
        if (logo && logo.width && logo.height) {
          ctx.save();
          ctx.globalAlpha = 0.08;
          ctx.drawImage(logo, W / 2 - 140, 210, 280, 280);
          ctx.restore();
        }

        // الشعار الأصلي أعلى اليمين
        var lx = W - 86, ly = 71, lr = 58;
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(lx, ly, lr, 0, Math.PI * 2); ctx.fill();
        if (logo && logo.width && logo.height) {
          var s = Math.min((lr * 2 - 6) / logo.width, (lr * 2 - 6) / logo.height);
          ctx.save(); ctx.beginPath(); ctx.arc(lx, ly, lr - 3, 0, Math.PI * 2); ctx.clip();
          ctx.drawImage(logo, lx - (logo.width * s) / 2, ly - (logo.height * s) / 2, logo.width * s, logo.height * s);
          ctx.restore();
        }

        // العنوان الرسمي
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff'; ctx.font = '800 34px ' + FONT;
        ctx.fillText('بطاقة منخرط', (W - 150) / 2 + 20, 56);
        ctx.fillStyle = GOLD; ctx.font = '700 22px ' + FONT;
        ctx.fillText(officialTitle, (W - 150) / 2 + 20, 108);

        // رمز QR ديناميكي على اليسار
        var qx = 46, qy = 186, qb = 264;
        ctx.strokeStyle = NAVY; ctx.lineWidth = 3;
        roundRect(ctx, qx - 10, qy - 10, qb + 20, qb + 20, 16); ctx.stroke();
        drawQr(ctx, url, qx, qy, qb);
        ctx.textAlign = 'center';
        ctx.fillStyle = NAVY; ctx.font = '700 20px ' + FONT;
        ctx.fillText('امسح الرمز للدخول إلى فضاء الأولياء', qx + qb / 2, qy + qb + 36);

        // حقول البيانات المعتمدة فقط (بدون الفرع أو القسم)
        var rx = W - 44, colL = 360, rowW = rx - colL;
        var rows = [
          ['رقم التسجيل:', memberLabel(info.membership_no != null ? info.membership_no : info.member_no)],
          ['الإسم واللقب:', info.full_name || '—'],
          ['تاريخ الميلاد:', dateLabel(info.dob)],
          ['نوع الإعاقة:', disabilityCode(info.disability)]
        ];
        rows.forEach(function (rw, idx) {
          var ry = 178 + idx * 78;
          ctx.fillStyle = 'rgba(248, 250, 252, 0.94)';
          ctx.strokeStyle = NAVY; ctx.lineWidth = 2;
          roundRect(ctx, colL, ry, rowW, 62, 16); ctx.fill(); ctx.stroke();
          ctx.fillStyle = NAVY;
          roundRect(ctx, rx - 34, ry, 34, 62, 12); ctx.fill();

          ctx.textAlign = 'right';
          ctx.fillStyle = NAVY; ctx.font = '700 22px ' + FONT;
          ctx.fillText(rw[0], rx - 48, ry + 39);

          ctx.textAlign = 'left';
          ctx.fillStyle = INK;
          fitFont(ctx, rw[1], '800', idx === 3 ? 28 : 24, rowW - 220);
          ctx.fillText(rw[1], colL + 22, ry + 39);
        });

        // بيانات الدخول أسفل البطاقة (عند توفرها للطباعة الفورية دون تخزين كلمة مرور)
        var userTxt = info.username ? String(info.username) : (memberLabel(info.membership_no != null ? info.membership_no : info.member_no));
        var passTxt = info.password_hint ? String(info.password_hint) : '••••••••';
        ctx.fillStyle = NAVY; ctx.fillRect(0, H - 72, W, 72);
        ctx.fillStyle = GOLD; ctx.fillRect(0, H - 76, W, 4);

        ctx.fillStyle = '#ffffff';
        roundRect(ctx, W - 470, H - 60, 426, 46, 20); ctx.fill();
        roundRect(ctx, 44, H - 60, 426, 46, 20); ctx.fill();
        ctx.textAlign = 'right'; ctx.fillStyle = NAVY; ctx.font = '700 20px ' + FONT;
        ctx.fillText('اسم المستخدم: ' + userTxt, W - 64, H - 30);
        ctx.fillText('كلمة المرور: ' + passTxt, 450, H - 30);

        return { jpeg: cv.toDataURL('image/jpeg', 0.96), url: url, width: W, height: H };
      });
    });
  }

  function toPdf(card) {
    if (!root.DE_PDF || typeof root.DE_PDF.fromJpeg !== 'function') throw new Error('مكوّن PDF غير محمّل.');
    return root.DE_PDF.fromJpeg(card.jpeg, card.width, card.height, { mmW: 85.6, mmH: 54 });
  }

  function printCard(cardUrl) {
    var w = window.open('', '_blank', 'width=520,height=380');
    if (!w) return false;
    var doc = w.document;
    doc.open(); doc.close();
    doc.title = 'بطاقة منخرط — دار الإحسان';
    var st = doc.createElement('style');
    st.textContent = '@page{size:85.6mm 54mm;margin:0}body{margin:0;display:flex;align-items:center;justify-content:center;background:#fff}img{width:85.6mm;height:54mm;display:block}';
    doc.head.appendChild(st);
    var im = doc.createElement('img');
    im.onload = function () { setTimeout(function () { w.focus(); w.print(); }, 150); };
    im.src = cardUrl;
    doc.body.appendChild(im);
    return true;
  }

  root.DECARD = { render: render, toPdf: toPdf, print: printCard, disabilityCode: disabilityCode };
})(window);
