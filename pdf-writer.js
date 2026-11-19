/* ══════════════════════════════════════════════════════════════════════════════
   DAR EL IHSAN — NATIVE CLIENT-SIDE PDF & REPORT GENERATOR (منشئ ملفات وتقارير التقييم الرسمية)
   ══════════════════════════════════════════════════════════════════════════════
   - ينتج ملفات PDF 1.4 قياسية حقيقية تفتح في أي قارئ PDF (Acrobat, Chrome, Edge, Safari, iOS, Android).
   - يدعم 3 أنماط رسمية لتقارير التقييم البيداغوجي:
     1) notes      : التقرير البيداغوجي الوصفي (تقرير الملاحظات والتوجيهات) — مضبوط في صفحة A4 واحدة.
     2) statistics : التقرير التقييمي الكمي (كشف النتائج والأداء البياني: جدول المجالات + المشرفون + الأعمدة البيانية + الدائرة النسبية) مطابق للصورة الرسمية (56725.jpg).
     3) full       : التقرير البيداغوجي الشامل (للإدارة فقط: يجمع تقرير الملاحظات + التقرير الكمي + الجداول التفصيلية لكافة المجالات والمهارات).
   - معيار اكتساب المهارة المعتمد في دار الإحسان: المهارة مكتسبة عند درجة 4/5 فما فوق (أو "نعم").
   ══════════════════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  var A4_W_PT = 595.28;
  var A4_H_PT = 841.89;
  var EVAL_MARKER = '/*DE_EVAL_V1*/';

  var DOMAIN_SHORT_NAMES = {
    'مجال الاستقلالية (الحياة اليومية والعناية بالذات)': 'مهارات الاعتماد على الذات',
    'الرعاية الذاتية (الحياة اليومية والعناية بالذات)': 'مهارات الاعتماد على الذات',
    'مجال المهارات الحركية الدقيقة': 'الحركة الدقيقة',
    'التربية الحركية الدقيقة': 'الحركة الدقيقة',
    'مجال المهارات الحركية الكبرى': 'الحركة الكبرى',
    'التربية الحركية الكبرى': 'الحركة الكبرى',
    'مجال ما قبل الأكاديمي': 'مهارات ما قبل الأكاديمي',
    'ما قبل الأكاديمي': 'مهارات ما قبل الأكاديمي',
    'المجال الأكاديمي': 'المهارات الأكاديمية',
    'الأكاديمي': 'المهارات الأكاديمية',
    'مجال التقليد': 'التقليد والمحاكاة',
    'الإدراك الحسي': 'الإدراك الحسي والحواس',
    'مجال مهارات الحضور والانتباه': 'مهارات الحضور والانتباه',
    'التفاعل الاجتماعي': 'المهارات الاجتماعية',
    'مجال التواصل': 'التواصل واللغة',
    'النطق والتواصل وحضور والانتباه': 'اللغة والتواصل والانتباه'
  };

  var SLICE_PALETTE = [
    '#16A34A', '#2563EB', '#EA580C', '#7C3AED', '#0891B2',
    '#DB2777', '#CA8A04', '#4F46E5', '#0D9488', '#DC2626',
    '#65A30D', '#9333EA', '#0284C7', '#D97706', '#2563EB'
  ];

  // دالة تظليل وتفتيح الألوان لرسم الحواف والمجسم ثلاثي الأبعاد للدائرة النسبية
  function shadeHexColor(hex, factor) {
    var s = String(hex || '#16A34A').replace(/^#/, '');
    if (s.length === 3) {
      s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    }
    var num = parseInt(s, 16);
    if (isNaN(num)) return hex;
    var r = (num >> 16) & 255;
    var g = (num >> 8) & 255;
    var b = num & 255;
    if (factor < 1) {
      r = Math.max(0, Math.min(255, Math.round(r * factor)));
      g = Math.max(0, Math.min(255, Math.round(g * factor)));
      b = Math.max(0, Math.min(255, Math.round(b * factor)));
    } else {
      var boost = factor - 1;
      r = Math.max(0, Math.min(255, Math.round(r + (255 - r) * boost)));
      g = Math.max(0, Math.min(255, Math.round(g + (255 - g) * boost)));
      b = Math.max(0, Math.min(255, Math.round(b + (255 - b) * boost)));
    }
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function shortenDomainName(name) {
    var s = String(name || '').trim();
    if (DOMAIN_SHORT_NAMES[s]) return DOMAIN_SHORT_NAMES[s];
    s = s.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
    return s.length > 26 ? s.slice(0, 26) : s;
  }

  function formatPctAr(val, decimals) {
    var d = decimals != null ? decimals : 1;
    var n = Number(val || 0);
    if (!isFinite(n)) n = 0;
    var fixed = n.toFixed(d).replace(/\.0+$/, '');
    return fixed;
  }

  function formatPctComma(val, decimals) {
    var d = decimals != null ? decimals : 1;
    var n = Number(val || 0);
    if (!isFinite(n)) n = 0;
    return n.toFixed(d).replace('.', ',');
  }

  function buildPdfBinary(pagesJpeg) {
    var parts = [];
    var offsets = {};
    var enc = new TextEncoder();

    function writeStr(str) { parts.push(enc.encode(str)); }
    function writeBytes(bytes) {
      if (bytes instanceof Uint8Array) parts.push(bytes);
      else if (bytes instanceof ArrayBuffer) parts.push(new Uint8Array(bytes));
      else parts.push(enc.encode(String(bytes)));
    }
    function currentOffset() {
      var sum = 0;
      for (var i = 0; i < parts.length; i++) sum += parts[i].byteLength;
      return sum;
    }

    writeStr('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

    var numPages = pagesJpeg.length;
    offsets[1] = currentOffset();
    writeStr('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

    var kidsStr = [];
    for (var i = 0; i < numPages; i++) kidsStr.push((3 + i * 3) + ' 0 R');
    offsets[2] = currentOffset();
    writeStr('2 0 obj\n<< /Type /Pages /Kids [' + kidsStr.join(' ') + '] /Count ' + numPages + ' >>\nendobj\n');

    for (var p = 0; p < numPages; p++) {
      var item = pagesJpeg[p];
      var pObj = 3 + p * 3;
      var imObj = 4 + p * 3;
      var cObj = 5 + p * 3;
      var imgW = item.width || 1240;
      var imgH = item.height || 1754;
      var isLandscape = imgW > imgH;
      var pageW = isLandscape ? A4_H_PT : A4_W_PT;
      var pageH = isLandscape ? A4_W_PT : A4_H_PT;
      var jpgBytes = item.data;

      offsets[pObj] = currentOffset();
      writeStr(pObj + ' 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pageW.toFixed(2) + ' ' + pageH.toFixed(2) + '] /Resources << /XObject << /Im' + (p + 1) + ' ' + imObj + ' 0 R >> >> /Contents ' + cObj + ' 0 R >>\nendobj\n');

      offsets[imObj] = currentOffset();
      writeStr(imObj + ' 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + imgW + ' /Height ' + imgH + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpgBytes.byteLength + ' >>\nstream\n');
      writeBytes(jpgBytes);
      writeStr('\nendstream\nendobj\n');

      var cStr = 'q\n' + pageW.toFixed(2) + ' 0 0 ' + pageH.toFixed(2) + ' 0 0 cm\n/Im' + (p + 1) + ' Do\nQ\n';
      offsets[cObj] = currentOffset();
      writeStr(cObj + ' 0 obj\n<< /Length ' + cStr.length + ' >>\nstream\n' + cStr + 'endstream\nendobj\n');
    }

    var totalObjs = 2 + numPages * 3;
    var xrefOffset = currentOffset();
    writeStr('xref\n0 ' + (totalObjs + 1) + '\n0000000000 65535 f \n');
    for (var o = 1; o <= totalObjs; o++) {
      var offStr = ('0000000000' + offsets[o]).slice(-10);
      writeStr(offStr + ' 00000 n \n');
    }
    writeStr('trailer\n<< /Size ' + (totalObjs + 1) + ' /Root 1 0 R >>\nstartxref\n' + xrefOffset + '\n%%EOF\n');

    var totalLen = 0;
    for (var k = 0; k < parts.length; k++) totalLen += parts[k].byteLength;
    var full = new Uint8Array(totalLen);
    var pos = 0;
    for (var j = 0; j < parts.length; j++) {
      full.set(parts[j], pos);
      pos += parts[j].byteLength;
    }
    return full;
  }

  function canvasToJpegBytes(canvas, quality) {
    return new Promise(function (resolve) {
      if (canvas.toBlob) {
        canvas.toBlob(function (blob) {
          var reader = new FileReader();
          reader.onload = function () { resolve(new Uint8Array(reader.result)); };
          reader.readAsArrayBuffer(blob);
        }, 'image/jpeg', quality || 0.94);
      } else {
        var dataUrl = canvas.toDataURL('image/jpeg', quality || 0.94);
        var bin = atob(dataUrl.split(',')[1]);
        var u8 = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        resolve(u8);
      }
    });
  }

  function downloadPdf(pdfBytes, filename) {
    var blob = new Blob([pdfBytes], { type: 'application/pdf' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename || 'document.pdf';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 300);
  }

  function loadLogoImage() {
    return new Promise(function (resolve) {
      if (typeof Image === 'undefined') return resolve(null);
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () {
        var img2 = new Image();
        img2.onload = function () { resolve(img2); };
        img2.onerror = function () { resolve(null); };
        img2.src = 'logo.png';
      };
      img.src = 'logo-sq.png';
    });
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawRoundedRect(ctx, x, y, w, h, r) {
    roundRect(ctx, x, y, w, h, r);
  }

  function wrapLines(ctx, text, maxW, maxLines) {
    var cleanText = String(text || '').replace(/\r\n/g, '\n');
    var paragraphs = cleanText.split('\n');
    var lines = [];
    paragraphs.forEach(function (para) {
      var words = para.split(/\s+/).filter(Boolean);
      if (!words.length) return;
      var cur = '';
      words.forEach(function (w) {
        var test = cur ? (cur + ' ' + w) : w;
        if (ctx.measureText(test).width <= maxW || !cur) {
          cur = test;
        } else {
          lines.push(cur);
          cur = w;
        }
      });
      if (cur) lines.push(cur);
    });
    if (!lines.length) return ['—'];
    if (maxLines && lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      lines[maxLines - 1] = lines[maxLines - 1].replace(/[.\s…]+$/, '') + '…';
    }
    return lines;
  }

  // استخراج وتحليل بيانات التقييم سواء مُرّر الكائن الخام r أو الكائن المحلل ev
  function ensureParsedEval(rep) {
    if (!rep) return { domains: [], supervisors: [], abilities: {}, strengths: [], weaknesses: [], recommendations: [] };
    var cur = (root && root.DE_CURRICULUM) || {};
    var domainKeys = Object.keys(cur);
    var res = {
      id: rep.id || null,
      title: rep.title || 'تقرير اللجنة البيداغوجية والتربوية',
      report_date: rep.report_date || new Date().toISOString().slice(0, 10),
      term: rep.term || 'الثلاثي الأخير',
      school_year: rep.school_year || '2024/2025',
      degree_of_disability: rep.degree_of_disability || 'متوسطة',
      qualification_level: rep.qualification_level || '',
      supervisors: Array.isArray(rep.supervisors) && rep.supervisors.length ? rep.supervisors : [{ name: 'إدارة المركز', role: 'مدير المركز' }],
      general_report: rep.general_report || rep.notes || '',
      abilities: Object.assign({
        current_potentials: '',
        cognitive_intellectual: '',
        language_receptive_expressive: '',
        communication_behavioral: '',
        academic_preacademic: '',
        motor_independence: ''
      }, rep.abilities || {}),
      strengths: Array.isArray(rep.strengths) ? rep.strengths : [],
      weaknesses: Array.isArray(rep.weaknesses) ? rep.weaknesses : [],
      recommendations: Array.isArray(rep.recommendations) ? rep.recommendations : [],
      domains: Array.isArray(rep.domains) && rep.domains.length && rep.domains[0].ratings ? rep.domains : []
    };

    if (typeof rep.activities === 'string' && rep.activities.indexOf(EVAL_MARKER) === 0) {
      try {
        var rawJson = JSON.parse(rep.activities.slice(EVAL_MARKER.length));
        if (rawJson && typeof rawJson === 'object') {
          if (rawJson.eval_type) res.eval_type = rawJson.eval_type;
          if (rawJson.reinforcers) res.reinforcers = rawJson.reinforcers;
          if (rawJson.interview) res.interview = rawJson.interview;
          if (rawJson.annual_final) res.annual_final = rawJson.annual_final;
          if (rawJson.term) res.term = rawJson.term;
          if (rawJson.school_year) res.school_year = rawJson.school_year;
          if (rawJson.degree_of_disability) res.degree_of_disability = rawJson.degree_of_disability;
          if (rawJson.qualification_level) res.qualification_level = rawJson.qualification_level;
          if (Array.isArray(rawJson.supervisors) && rawJson.supervisors.length) res.supervisors = rawJson.supervisors;
          if (rawJson.general_report) res.general_report = rawJson.general_report;
          if (rawJson.abilities) res.abilities = Object.assign({}, res.abilities, rawJson.abilities);
          if (Array.isArray(rawJson.strengths) && rawJson.strengths.length) res.strengths = rawJson.strengths;
          if (Array.isArray(rawJson.weaknesses) && rawJson.weaknesses.length) res.weaknesses = rawJson.weaknesses;
          if (Array.isArray(rawJson.recommendations) && rawJson.recommendations.length) res.recommendations = rawJson.recommendations;

          if (Array.isArray(rawJson.domains) && rawJson.domains.length) {
            res.domains = rawJson.domains.map(function (dm) {
              if (dm.domain && Array.isArray(dm.ratings)) {
                var baseList = cur[dm.domain] || [];
                return {
                  domain: dm.domain,
                  ratings: dm.ratings.map(function (rt, idx) {
                    var skName = (rt && (rt.skill || rt.item)) || baseList[idx] || ('مهارة ' + (idx + 1));
                    return {
                      num: idx + 1,
                      skill: skName,
                      item: skName,
                      score: (rt && rt.score != null) ? String(rt.score) : '',
                      yn: (rt && rt.yn) || '',
                      note: (rt && (rt.note || rt.obs)) || ''
                    };
                  })
                };
              }
              var domName = typeof dm.d === 'number' ? (domainKeys[dm.d] || domainKeys[0]) : (dm.domain || domainKeys[0]);
              var skList = cur[domName] || [];
              var ratingsMap = {};
              if (Array.isArray(dm.r)) {
                dm.r.forEach(function (entry) {
                  ratingsMap[entry[0]] = { score: entry[1] != null ? String(entry[1]) : '', yn: entry[2] || '', note: entry[3] || '' };
                });
              } else if (dm.ratings && typeof dm.ratings === 'object') {
                ratingsMap = dm.ratings;
              }
              return {
                domain: domName,
                ratings: skList.map(function (sk, idx) {
                  var sv = ratingsMap[idx] || ratingsMap[sk] || {};
                  return { num: idx + 1, skill: sk, item: sk, score: sv.score != null ? String(sv.score) : '', yn: sv.yn || '', note: sv.note || '' };
                })
              };
            });
          }
        }
      } catch (e) {}
    }

    // دمج أي حقول مباشرة موجودة على الكائن rep لضمان عدم ضياع التعديلات الحية للطفل
    if (rep.eval_type) res.eval_type = rep.eval_type;
    if (rep.child_id) res.child_id = rep.child_id;
    if (rep.child_name) res.child_name = rep.child_name;
    if (rep.dob) res.dob = rep.dob;
    if (rep.disability) res.disability = rep.disability;
    if (rep.section_name) res.section_name = rep.section_name;
    if (rep.membership_no) res.membership_no = rep.membership_no;
    if (rep.term) res.term = rep.term;
    if (rep.school_year) res.school_year = rep.school_year;
    if (rep.degree_of_disability) res.degree_of_disability = rep.degree_of_disability;
    if (rep.qualification_level) res.qualification_level = rep.qualification_level;
    if (Array.isArray(rep.supervisors) && rep.supervisors.length) res.supervisors = rep.supervisors;
    if (rep.general_report) res.general_report = rep.general_report;
    if (rep.abilities && typeof rep.abilities === 'object') {
      Object.keys(rep.abilities).forEach(function (k) {
        if (rep.abilities[k]) res.abilities[k] = rep.abilities[k];
      });
    }
    if (Array.isArray(rep.strengths) && rep.strengths.some(Boolean)) res.strengths = rep.strengths;
    if (Array.isArray(rep.weaknesses) && rep.weaknesses.some(Boolean)) res.weaknesses = rep.weaknesses;
    if (Array.isArray(rep.recommendations) && rep.recommendations.some(Boolean)) res.recommendations = rep.recommendations;
    if (rep.reinforcers) res.reinforcers = Object.assign({}, res.reinforcers || {}, rep.reinforcers);
    if (rep.interview) res.interview = Object.assign({}, res.interview || {}, rep.interview);
    if (rep.annual_final) res.annual_final = Object.assign({}, res.annual_final || {}, rep.annual_final);
    if (rep.behavior_observation) res.behavior_observation = Object.assign({}, res.behavior_observation || {}, rep.behavior_observation);
    if (rep.target_behavior_eval) res.target_behavior_eval = Object.assign({}, res.target_behavior_eval || {}, rep.target_behavior_eval);
    if (rep.target_behavior_report) res.target_behavior_report = Object.assign({}, res.target_behavior_report || {}, rep.target_behavior_report);
    if (rep.mas_eval) res.mas_eval = Object.assign({}, res.mas_eval || {}, rep.mas_eval);
    if (rep.mas_behavior_report) res.mas_behavior_report = Object.assign({}, res.mas_behavior_report || {}, rep.mas_behavior_report);
    if (Array.isArray(rep.domains) && rep.domains.length && rep.domains[0] && Array.isArray(rep.domains[0].ratings)) {
      var hasDirectRated = rep.domains.some(function (d) {
        return (d.ratings || []).some(function (r) { return (r.score !== '' && r.score != null) || r.yn || r.note; });
      });
      if (hasDirectRated || !res.domains.length) {
        res.domains = rep.domains;
      }
    }
    if (typeof rawJson !== 'undefined' && rawJson && typeof rawJson === 'object') {
      if (rawJson.child_id && !res.child_id) res.child_id = rawJson.child_id;
      if (rawJson.child_name && !res.child_name) res.child_name = rawJson.child_name;
      if (rawJson.dob && !res.dob) res.dob = rawJson.dob;
      if (rawJson.disability && !res.disability) res.disability = rawJson.disability;
      if (rawJson.section_name && !res.section_name) res.section_name = rawJson.section_name;
      if (rawJson.membership_no && !res.membership_no) res.membership_no = rawJson.membership_no;
      if (rawJson.target_behavior_eval) res.target_behavior_eval = Object.assign({}, res.target_behavior_eval || {}, rawJson.target_behavior_eval);
      if (rawJson.target_behavior_report) res.target_behavior_report = Object.assign({}, res.target_behavior_report || {}, rawJson.target_behavior_report);
      if (rawJson.mas_eval) res.mas_eval = Object.assign({}, res.mas_eval || {}, rawJson.mas_eval);
      if (rawJson.mas_behavior_report) res.mas_behavior_report = Object.assign({}, res.mas_behavior_report || {}, rawJson.mas_behavior_report);
      if (rawJson.behavior_observation) res.behavior_observation = Object.assign({}, res.behavior_observation || {}, rawJson.behavior_observation);
    }

    if (!res.domains.length && domainKeys.length) {
      var firstDk = domainKeys[0];
      res.domains.push({
        domain: firstDk,
        ratings: (cur[firstDk] || []).map(function (sk, idx) {
          return { num: idx + 1, skill: sk, item: sk, score: '', yn: '', note: '' };
        })
      });
    }
    return res;
  }

  // حساب إحصائيات المجالات والمهارات وفق معيار دار الإحسان: المهارة مكتسبة عند 4/5 فما فوق
  function computeEvaluationStats(rep) {
    var ev = ensureParsedEval(rep);
    var cur = (root && root.DE_CURRICULUM) || {};
    var totalEarned = 0, totalMax = 0, totalSkills = 0, acquiredSkills = 0;

    var domainStats = (ev.domains || []).map(function (dm, dIdx) {
      var dEarned = 0, dMax = 0, dAcquired = 0;
      var rawRatings = dm.ratings || [];
      var domSkills = cur[dm.domain] || [];
      var count = rawRatings.length || domSkills.length;
      var normalizedRatings = [];

      for (var sIdx = 0; sIdx < count; sIdx++) {
        var it = rawRatings[sIdx] || {};
        var skName = it.skill || it.item || domSkills[sIdx] || ('مهارة ' + (sIdx + 1));
        var sc = 0;
        var isRated = false;
        if (it.score !== '' && it.score != null) {
          var parsed = parseInt(it.score, 10);
          if (!isNaN(parsed)) { sc = parsed; isRated = true; }
        } else if (it.yn) {
          sc = (it.yn === 'نعم') ? 5 : 0;
          isRated = true;
        }
        dEarned += sc;
        dMax += 5;
        totalSkills++;
        // معيار دار الإحسان: المهارة تُحسب مكتسبة عند الدرجة 4/5 فما فوق (أو "نعم")
        var acquired = isRated && sc >= 4;
        if (acquired) {
          acquiredSkills++;
          dAcquired++;
        }
        normalizedRatings.push({
          num: sIdx + 1,
          skill: skName,
          score: sc,
          acquired: acquired,
          isRated: isRated,
          badgeText: isRated ? (it.yn ? it.yn : (sc + '/5')) : '0/5',
          statusText: acquired ? 'مكتسبة' : (isRated ? 'غير مكتسبة' : 'لم تقيَّم'),
          note: it.note || it.obs || (acquired ? 'مكتسبة (4/5 فما فوق)' : (isRated ? 'قيد الاكتساب' : 'لم تقيَّم'))
        });
      }

      totalEarned += dEarned;
      totalMax += dMax;
      // النسبة المئوية للمجال محسوبة من عدد المهارات المكتسبة مقسوماً على إجمالي مهارات المجال
      var pctNum = count > 0 ? (dAcquired / count) * 100 : 0;
      var pctRound = Math.round(pctNum * 10) / 10;
      return {
        name: dm.domain || ('مجال ' + (dIdx + 1)),
        shortName: shortenDomainName(dm.domain || ('مجال ' + (dIdx + 1))),
        count: count,
        acquired: dAcquired,
        earned: dEarned,
        max: dMax,
        pctNum: pctNum,
        pct: pctRound,
        pctFmt: formatPctAr(pctNum, 1),
        pctComma: formatPctComma(pctNum, 1),
        color: SLICE_PALETTE[dIdx % SLICE_PALETTE.length],
        ratings: normalizedRatings
      };
    });

    var overallPctNum = totalSkills > 0 ? (acquiredSkills / totalSkills) * 100 : 0;
    var overallPointsPctNum = totalMax > 0 ? (totalEarned / totalMax) * 100 : 0;

    return {
      ev: ev,
      domainStats: domainStats,
      totalSkills: totalSkills,
      acquiredSkills: acquiredSkills,
      remainingSkills: Math.max(0, totalSkills - acquiredSkills),
      overallPctNum: overallPctNum,
      overallPct: formatPctAr(overallPctNum, 2),
      overallPctComma: formatPctComma(overallPctNum, 2),
      remainingPctNum: Math.max(0, 100 - overallPctNum),
      remainingPctComma: formatPctComma(Math.max(0, 100 - overallPctNum), 1),
      totalEarned: totalEarned,
      totalMax: totalMax,
      overallPointsPct: formatPctAr(overallPointsPctNum, 1)
    };
  }

  function drawOfficialHeader(ctx, w, titleAr, logoImg) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, 1754);

    // إطار الصفحة الرسمي
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(36, 36, w - 72, 1682);

    // الشعار على اليسار كما في الوثيقة الرسمية (55043.jpg)
    if (logoImg && logoImg.width) {
      ctx.drawImage(logoImg, 65, 52, 115, 115);
    }

    ctx.textAlign = 'center';
    ctx.direction = 'rtl';
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 22px "IBM Plex Sans Arabic", "Cairo", sans-serif';
    ctx.fillText('جمعية أولياء الأطفال المعاقين ذهنيًا', w / 2, 74);

    ctx.font = 'bold 21px "IBM Plex Sans Arabic", "Cairo", sans-serif';
    ctx.fillText('المركز النفسي البيداغوجي دار الإحسان', w / 2, 102);

    ctx.fillStyle = '#475569';
    ctx.font = 'bold 17px "IBM Plex Sans Arabic", "Cairo", sans-serif';
    ctx.fillText('— العطف - غرداية —', w / 2, 126);

    ctx.fillStyle = '#1E3A8A';
    ctx.font = 'bold 16px "Plus Jakarta Sans", sans-serif';
    ctx.fillText("COMPTE RENDU DE L'EQUIPE PEDAGOGIQUE", w / 2, 149);

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 26px "IBM Plex Sans Arabic", "Cairo", sans-serif';
    ctx.fillText(titleAr || 'تقرير اللجنة البيداغوجية والتربوية', w / 2, 180);

    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(56, 196);
    ctx.lineTo(w - 56, 196);
    ctx.stroke();
  }

  // رسم شعار العلم الوطني الجزائري الدائري (مطابق لأعلى يسار الورقة في الصورة 56725.jpg)
  function drawAlgeriaFlagCircle(ctx, cx, cy, r) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    // النصف الأيسر أخضر والنصف الأيمن أبيض (كما في الصورة 56725.jpg)
    ctx.fillStyle = '#00853F';
    ctx.fillRect(cx - r, cy - r, r, r * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(cx, cy - r, r, r * 2);

    // الهلال الأحمر في المنتصف
    ctx.fillStyle = '#D21034';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.50, 0, Math.PI * 2);
    ctx.fill();

    // تفريغ الهلال
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx + r * 0.12, cy, r * 0.40, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#00853F';
    ctx.fillRect(cx - r, cy - r, r, r * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(cx, cy - r, r, r * 2);
    ctx.restore();

    // النجمة الخماسية الحمراء
    var sx = cx + r * 0.18;
    var sy = cy;
    var outerR = r * 0.22;
    var innerR = outerR * 0.38;
    ctx.fillStyle = '#D21034';
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var ang = -Math.PI / 2 + (i * Math.PI) / 5;
      var rad = (i % 2 === 0) ? outerR : innerR;
      var px = sx + Math.cos(ang) * rad;
      var py = sy + Math.sin(ang) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // إطار دائري ناعم
    ctx.save();
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // رسم صفحة التقرير الكمي لنتائج التقييم مطابقة 100% للصورة المرفقة (56725.jpg)
  function drawQuantitativeEvaluationPage(ctx, W, statsObj, childFullName, secName, kd, logoImg) {
    var ev = statsObj.ev;
    var domainStats = statsObj.domainStats;
    var totalSkills = statsObj.totalSkills;
    var acquiredSkills = statsObj.acquiredSkills;
    var overallPctNum = statsObj.overallPctNum;
    var overallPctComma = statsObj.overallPctComma;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, 1754);

    // الإطار الخارجي للصفحة
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2;
    ctx.strokeRect(32, 32, W - 64, 1690);

    // 1. الترويسة العلوية المطابقة للصورة (56725.jpg)
    // الشعار على اليمين
    if (logoImg && logoImg.width) {
      ctx.drawImage(logoImg, 48, 44, 125, 125);
    }
    // العلم الجزائري الدائري على اليسار
    drawAlgeriaFlagCircle(ctx, 112, 106, 56);

    ctx.direction = 'rtl';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 22px "Cairo", "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText('جمعية أولياء الأطفال المعاقين ذهنيًا', W / 2, 74);
    ctx.font = 'bold 21px "Cairo", "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText('المركز النفسي البيداغوجي دار الإحسان', W / 2, 106);
    ctx.font = 'bold 19px "Cairo", "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText('- العطف - غرداية -', W / 2, 136);

    ctx.fillStyle = '#1D4ED8';
    ctx.font = 'bold 22px "Cairo", "IBM Plex Sans Arabic", sans-serif';
    var schoolYrTxt = (ev.school_year || '2024 - 2025').replace('/', ' - ');
    ctx.fillText('تقرير الكمي (quantitative) — نتائج تقييم الأداء الحالي ' + schoolYrTxt, W / 2, 172);

    // 2. سطر بيانات الطالب (اسم ولقب الحالة | تاريخ الميلاد | فوج)
    var rawDob = (kd && kd.dob) || ev.dob || '';
    var dobFmt = '—';
    if (rawDob) {
      var mDob = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(rawDob).trim());
      dobFmt = mDob ? (mDob[1] + '/' + mDob[2] + '/' + mDob[3]) : String(rawDob);
    }
    var memNoVal = (kd && kd.membership_no) || ev.membership_no || '';
    var memPrefix = memNoVal ? (memNoVal + ' * ') : '';
    var studentFullLabel = memPrefix + (childFullName || (kd && kd.full_name) || ev.child_name || 'تلميذ المركز');
    var groupLabel = ev.qualification_level || secName || (kd && kd.section) || ev.section_name || 'القسم الخاص';

    var infoY = 216;
    ctx.fillStyle = '#0F172A';
    ctx.textAlign = 'right';
    ctx.font = 'bold 18px "Cairo", "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText('اسم ولقب الحالة:   ' + studentFullLabel, W - 52, infoY);
    ctx.fillText('تاريخ الميلاد:   ' + dobFmt, 535, infoY);
    ctx.fillText('فوج:   ' + groupLabel, 285, infoY);

    // ══════════════════════════════════════════════════════════════════════════
    // 3. النصف العلوي والأوسط:
    //    - على اليمين: جدول المجالات وعدد المهارات المكتسبة فقط + المجموع العام
    //    - على اليسار (أعلى): جدول المشرفين (مع عمود "المشرفون" العمودي)
    //    - على اليسار (وسط): مخطط الأعمدة البيانية (برتقالي للمجال + أخضر للمكتسبة + النسب)
    // ══════════════════════════════════════════════════════════════════════════

    // أ) جدول المجالات على اليمين (عمودان فقط: المجال | عدد المهارات المكتسبة)
    var tblRightX = 796;
    var tblW = (W - 52) - tblRightX; // 392px
    var colCountW = 128;              // العمود الأيسر: عدد المهارات المكتسبة
    var colDomainW = tblW - colCountW; // العمود الأيمن: المجال (264px)
    var tblTopY = 268;
    var tblMaxBottomY = 956;

    var numDomainRows = Math.max(1, domainStats.length);
    var headerH = 34;
    var totalRowH = 38;
    var availRowsH = tblMaxBottomY - tblTopY - headerH - totalRowH;
    var domRowH = Math.min(38, Math.max(24, Math.floor(availRowsH / numDomainRows)));

    // ترويسة جدول المجالات (المجال | عدد المهارات المكتسبة)
    ctx.fillStyle = '#EEF2FF';
    ctx.fillRect(tblRightX, tblTopY, tblW, headerH);
    ctx.strokeStyle = '#4F46E5';
    ctx.lineWidth = 1.4;
    ctx.strokeRect(tblRightX, tblTopY, colCountW, headerH);
    ctx.strokeRect(tblRightX + colCountW, tblTopY, colDomainW, headerH);

    ctx.fillStyle = '#1E1B4B';
    ctx.textAlign = 'center';
    ctx.font = 'bold 14.5px "Cairo", "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText('المجال', tblRightX + colCountW + colDomainW / 2, tblTopY + 23);
    ctx.font = 'bold 12.5px "Cairo", "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText('عدد المهارات المكتسبة', tblRightX + colCountW / 2, tblTopY + 22);

    var curTblY = tblTopY + headerH;
    domainStats.forEach(function (dm, idx) {
      ctx.fillStyle = (idx % 2 === 0) ? '#FFFFFF' : '#F8FAFC';
      ctx.fillRect(tblRightX, curTblY, tblW, domRowH);
      ctx.strokeStyle = '#6366F1';
      ctx.lineWidth = 1.1;
      ctx.strokeRect(tblRightX, curTblY, colCountW, domRowH);
      ctx.strokeRect(tblRightX + colCountW, curTblY, colDomainW, domRowH);

      var textY = curTblY + Math.round(domRowH * 0.68);
      // اسم المجال فقط
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 14px "Cairo", "IBM Plex Sans Arabic", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(dm.shortName, tblRightX + colCountW + colDomainW / 2, textY);

      // عدد المهارات المكتسبة باللون الأحمر كما في الصورة
      ctx.fillStyle = '#DC2626';
      ctx.font = 'bold 16px "Cairo", "IBM Plex Sans Arabic", sans-serif';
      ctx.fillText(String(dm.acquired), tblRightX + colCountW / 2, textY);

      curTblY += domRowH;
    });

    // صف المجموع العام في أسفل جدول المجالات
    ctx.fillStyle = '#FFF1F2';
    ctx.fillRect(tblRightX, curTblY, tblW, totalRowH);
    ctx.strokeStyle = '#4F46E5';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(tblRightX, curTblY, colCountW, totalRowH);
    ctx.strokeRect(tblRightX + colCountW, curTblY, colDomainW, totalRowH);

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 18px "Cairo", "IBM Plex Sans Arabic", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('المجموع العام', tblRightX + colCountW + colDomainW / 2, curTblY + 26);

    ctx.fillStyle = '#DC2626';
    ctx.font = 'bold 20px "Cairo", "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText(String(acquiredSkills), tblRightX + colCountW / 2, curTblY + 27);

    // ب) جدول المشرفين في أعلى اليسار (مطابق للصورة 56725.jpg)
    var supX = 52;
    var supTopY = 236;
    var supColSignW = 175; // الامضاء
    var supColRoleW = 185; // التخصص
    var supColNameW = 185; // اسم المشرف
    var supVertW = 60;     // عمود "المشرفون" العمودي
    var supRowH = 33;

    var supsList = (ev.supervisors && ev.supervisors.length) ? ev.supervisors.slice(0, 5) : [{ name: 'إدارة المركز', role: 'مدير المركز' }];
    var displaySupsCount = Math.max(4, supsList.length);

    // ترويسة جدول المشرفين (3 أعمدة: اسم المشرف | التخصص | الامضاء)
    var sxSign = supX;
    var sxRole = sxSign + supColSignW;
    var sxName = sxRole + supColRoleW;
    var sxVert = sxName + supColNameW;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(sxSign, supTopY, supColSignW + supColRoleW + supColNameW, supRowH);
    ctx.strokeStyle = '#6366F1';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(sxSign, supTopY, supColSignW, supRowH);
    ctx.strokeRect(sxRole, supTopY, supColRoleW, supRowH);
    ctx.strokeRect(sxName, supTopY, supColNameW, supRowH);

    ctx.fillStyle = '#0F172A';
    ctx.textAlign = 'center';
    ctx.font = 'bold 15px "Cairo", "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText('اسم المشرف', sxName + supColNameW / 2, supTopY + 22);
    ctx.fillText('التخصص', sxRole + supColRoleW / 2, supTopY + 22);
    ctx.fillText('الامضاء', sxSign + supColSignW / 2, supTopY + 22);

    // صفوف المشرفين
    var sy = supTopY + supRowH;
    for (var si = 0; si < displaySupsCount; si++) {
      var sp = supsList[si] || { name: '', role: '' };
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(sxSign, sy, supColSignW + supColRoleW + supColNameW, supRowH);
      ctx.strokeStyle = '#6366F1';
      ctx.strokeRect(sxSign, sy, supColSignW, supRowH);
      ctx.strokeRect(sxRole, sy, supColRoleW, supRowH);
      ctx.strokeRect(sxName, sy, supColNameW, supRowH);

      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 14.5px "Cairo", "IBM Plex Sans Arabic", sans-serif';
      if (sp.name) ctx.fillText(String(sp.name).slice(0, 26), sxName + supColNameW / 2, sy + 22);
      if (sp.role) ctx.fillText(String(sp.role).slice(0, 26), sxRole + supColRoleW / 2, sy + 22);
      sy += supRowH;
    }

    // الخلية العمودية المدمجة "المشرفون" على يمين صفوف المشرفين
    var vertH = displaySupsCount * supRowH;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(sxVert, supTopY + supRowH, supVertW, vertH);
    ctx.strokeStyle = '#6366F1';
    ctx.strokeRect(sxVert, supTopY + supRowH, supVertW, vertH);

    ctx.save();
    ctx.translate(sxVert + supVertW / 2 + 5, supTopY + supRowH + vertH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#0F172A';
    ctx.textAlign = 'center';
    ctx.font = 'bold 20px "Cairo", "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText('المشرفون', 0, 0);
    ctx.restore();

    // ج) مخطط الأعمدة البيانية (تحت جدول المشرفين على اليسار)
    var chartTitleY = sy + 28;
    var chartCenterX = 418;
    ctx.fillStyle = '#0F172A';
    ctx.textAlign = 'center';
    ctx.font = 'bold 16px "Cairo", "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText('أعمدة بيانية تمثل نتائج تقييم الأداء الحالي للطالب ' + studentFullLabel, chartCenterX, chartTitleY);

    // وسيلة إيضاح مختصرة للأعمدة بدون أي تداخل
    var legY = chartTitleY + 22;
    ctx.font = 'bold 11.5px "Cairo", "IBM Plex Sans Arabic", sans-serif';
    ctx.textAlign = 'right';

    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(758, legY - 10, 12, 12);
    ctx.fillStyle = '#334155';
    ctx.fillText('البرتقالي: المجال (في الأعلى إجمالي المهارات)', 752, legY);

    ctx.fillStyle = '#16A34A';
    ctx.fillRect(465, legY - 10, 12, 12);
    ctx.fillStyle = '#15803D';
    ctx.fillText('الأخضر: عدد ونسبة المهارات المكتسبة (بمعيار 4/5 فما فوق)', 459, legY);

    var plotX = 104;
    var plotY = legY + 34;
    var plotW = 670;
    var plotH = 235;

    // شبكة المحور العمودي (0%، 25%، 50%، 75%، 100%)
    var yTicks = [0, 25, 50, 75, 100];
    ctx.textAlign = 'right';
    ctx.font = 'bold 12.5px "Plus Jakarta Sans", "Cairo", sans-serif';
    yTicks.forEach(function (tk) {
      var ty = plotY + plotH - (tk / 100) * plotH;
      ctx.strokeStyle = tk === 0 ? '#64748B' : '#E2E8F0';
      ctx.lineWidth = tk === 0 ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(plotX, ty);
      ctx.lineTo(plotX + plotW, ty);
      ctx.stroke();

      ctx.fillStyle = '#334155';
      if (tk === 100) {
        ctx.fillText('100', plotX - 10, ty + 2);
        ctx.fillText('%', plotX - 14, ty + 16);
      } else {
        ctx.fillText(tk + '%', plotX - 10, ty + 4);
      }
    });

    // بيانات الأعمدة: المجالات + عمود المجموع العام
    var barItems = domainStats.map(function (dm) {
      return {
        label: dm.shortName,
        count: dm.count,
        acquired: dm.acquired,
        pctNum: dm.pctNum,
        pctFmt: dm.pctFmt,
        isTotal: false
      };
    });
    barItems.push({
      label: 'المجموع العام',
      count: totalSkills,
      acquired: acquiredSkills,
      pctNum: overallPctNum,
      pctFmt: formatPctAr(overallPctNum, 1),
      isTotal: true
    });

    var numBars = barItems.length;
    var slotW = plotW / numBars;
    var barW = Math.min(34, Math.max(14, Math.floor(slotW * 0.62)));

    barItems.forEach(function (item, bIdx) {
      var bx = plotX + bIdx * slotW + (slotW - barW) / 2;
      var cxBar = bx + barW / 2;

      // 1. في أعلى العمود باللون الأحمر: إجمالي عدد المهارات لذلك المجال
      ctx.fillStyle = '#DC2626';
      ctx.textAlign = 'center';
      ctx.font = 'bold 13px "Plus Jakarta Sans", "Cairo", sans-serif';
      ctx.fillText(String(item.count), cxBar, plotY - 8);

      // 2. العمود البرتقالي الكامل (يمثل المجال 100%)
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(bx, plotY, barW, plotH);
      ctx.strokeStyle = '#D97706';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(bx, plotY, barW, plotH);

      // 3. الشريط الأخضر في الأسفل بحسب نسبة المهارات المكتسبة في ذلك المجال
      var clampedPct = Math.max(0, Math.min(100, item.pctNum));
      var greenH = (clampedPct / 100) * plotH;
      if (item.acquired > 0 && greenH < 20) greenH = 20;

      if (item.acquired > 0) {
        var gy = plotY + plotH - greenH;
        ctx.fillStyle = item.isTotal ? '#0284C7' : '#16A34A';
        ctx.fillRect(bx, gy, barW, greenH);
        ctx.strokeStyle = item.isTotal ? '#0369A1' : '#15803D';
        ctx.lineWidth = 1;
        ctx.strokeRect(bx, gy, barW, greenH);

        // رقم المهارات المكتسبة داخل الشريط الأخضر
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 12px "Plus Jakarta Sans", "Cairo", sans-serif';
        ctx.fillText(String(item.acquired), cxBar, plotY + plotH - 5);
      } else {
        // عند صفر مهارات مكتسبة يظهر 0 باللون الأخضر أسفل خط القاعدة كما في الصورة 56725.jpg
        ctx.fillStyle = '#15803D';
        ctx.font = 'bold 12px "Plus Jakarta Sans", "Cairo", sans-serif';
        ctx.fillText('0', cxBar, plotY + plotH + 14);
      }

      // 4. كتابة النسبة المئوية للمجال على العمود مباشرة (حسب المهارات المكتسبة في المجال)
      ctx.save();
      var pctText = item.pctFmt + '%';
      var pctMidY = plotY + plotH * 0.45;
      ctx.translate(cxBar + 4, pctMidY);
      ctx.rotate(-Math.PI / 2);
      ctx.font = 'bold 11.5px "Plus Jakarta Sans", "Cairo", sans-serif';
      var tw = ctx.measureText(pctText).width;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
      roundRect(ctx, -tw / 2 - 4, -11, tw + 8, 15, 4);
      ctx.fill();
      ctx.fillStyle = item.acquired > 0 ? '#15803D' : '#7C2D12';
      ctx.textAlign = 'center';
      ctx.fillText(pctText, 0, 0);
      ctx.restore();

      // 5. اسم المجال عمودياً تحت العمود وبجانبه نسبته
      ctx.save();
      ctx.translate(cxBar + 4, plotY + plotH + 22);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = item.isTotal ? '#1E3A8A' : '#0F172A';
      ctx.font = (item.isTotal ? 'bold 13px ' : 'bold 12.5px ') + '"Cairo", "IBM Plex Sans Arabic", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(item.label, 0, 0);
      ctx.restore();
    });

    // السطر الأحمر أسفل مخطط الأعمدة كما في الصورة 56725.jpg
    var summaryLineY = plotY + plotH + 178;
    ctx.fillStyle = '#DC2626';
    ctx.textAlign = 'center';
    ctx.font = 'bold 16px "Cairo", "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText(
      'نتائج تقييم الأداء الحالي للطالب ' + studentFullLabel + ' - النسبة العامة ' + overallPctComma + ' %',
      chartCenterX,
      summaryLineY
    );

    // ══════════════════════════════════════════════════════════════════════════
    // 4. القسم السفلي: الدائرة النسبية (Donut Chart) مطابقة للصورة 56725.jpg
    //    مع تطابق النسب المئوية في الدائرة مع النسب المئوية في الأعمدة
    // ══════════════════════════════════════════════════════════════════════════
    var donutBoxX = 52;
    var donutBoxY = 982;
    var donutBoxW = W - 104;
    var donutBoxH = 665;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(donutBoxX, donutBoxY, donutBoxW, donutBoxH);
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(donutBoxX, donutBoxY, donutBoxW, donutBoxH);

    // بناء شرائح الدائرة النسبية بحيث تتطابق نسب كل مجال مع نسبته في الأعمدة
    // إجمالي الدائرة = 100% (موزعة بين المجالات المكتسبة والمتبقي لبلوغ 100%)
    var activeDomains = domainStats.filter(function (d) { return d.acquired > 0; });
    var donutSlices = [];
    var sumActivePct = 0;
    activeDomains.forEach(function (d) { sumActivePct += d.pctNum; });

    // حصة المكتسب الإجمالية في الحلقة الدائرية (مع حد أدنى بصري واضح عند وجود مهارات مكتسبة)
    var visualAcquiredShare = Math.min(0.92, Math.max(overallPctNum / 100, activeDomains.length ? Math.min(0.35, activeDomains.length * 0.04) : 0));
    if (overallPctNum >= 99.9) visualAcquiredShare = 1.0;
    if (acquiredSkills === 0) visualAcquiredShare = 0;

    var startAng = -Math.PI / 2;
    var curAng = startAng;

    activeDomains.forEach(function (d) {
      var weight = sumActivePct > 0 ? (d.pctNum / sumActivePct) : (1 / activeDomains.length);
      var sweep = visualAcquiredShare * Math.PI * 2 * weight;
      donutSlices.push({
        label: d.shortName,
        pctText: d.pctComma + '% (' + d.acquired + '/' + d.count + ')',
        pctOnly: d.pctComma + '%',
        color: d.color,
        darkColor: '#1E293B',
        start: curAng,
        end: curAng + sweep,
        mid: curAng + sweep / 2,
        isRemaining: false
      });
      curAng += sweep;
    });

    if (visualAcquiredShare < 1.0) {
      var remSweep = (1 - visualAcquiredShare) * Math.PI * 2;
      donutSlices.push({
        label: 'المتبقي لبلوغ 100%',
        pctText: statsObj.remainingPctComma + '%',
        pctOnly: statsObj.remainingPctComma + '%',
        color: '#F3DCE2',
        wallBaseColor: '#C49AA7',
        rimColor: '#885E6B',
        start: curAng,
        end: curAng + remSweep,
        mid: curAng + remSweep / 2,
        isRemaining: true
      });
    }

    donutSlices.forEach(function (sl) {
      if (!sl.wallBaseColor) sl.wallBaseColor = sl.color;
      if (!sl.rimColor) sl.rimColor = shadeHexColor(sl.color, 0.44);
    });

    var dCx = W / 2;
    var dCy = donutBoxY + 258;
    var outerR = 192;
    var innerR = 100;
    var tiltY = 0.63;
    var depth3D = 38;

    // 1) ظل سفلي ناعم تحت المجسم ثلاثي الأبعاد لإبراز العمق والارتفاع
    ctx.save();
    ctx.translate(dCx, dCy + depth3D + 12);
    ctx.scale(1, tiltY);
    ctx.beginPath();
    ctx.arc(0, 0, outerR + 8, 0, Math.PI * 2, false);
    ctx.arc(0, 0, Math.max(10, innerR - 8), Math.PI * 2, 0, true);
    ctx.closePath();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.16)';
    ctx.fill();
    ctx.restore();

    // 2) بناء الجدران والحواف الجانبية ثلاثية الأبعاد (Extruded 3D Solid Walls & Colored Edges)
    //    نرسم طبقات المجسم الملساء من الأسفل (depth3D) إلى الأعلى (1) بتدرج لوني ثلاثي الأبعاد لكل شريحة بدون خطوط متداخلة
    for (var dz = depth3D; dz >= 1; dz--) {
      var progress = 1 - (dz / depth3D); // 0 في القاعدة السفلية -> 1 قرب السطح العلوي
      var wallShade = 0.56 + 0.24 * progress;
      ctx.save();
      ctx.translate(dCx, dCy + dz);
      ctx.scale(1, tiltY);
      donutSlices.forEach(function (sl) {
        ctx.beginPath();
        ctx.arc(0, 0, outerR, sl.start, sl.end, false);
        ctx.arc(0, 0, innerR, sl.end, sl.start, true);
        ctx.closePath();
        ctx.fillStyle = shadeHexColor(sl.wallBaseColor, sl.isRemaining ? (0.78 + 0.16 * progress) : wallShade);
        ctx.fill();
      });
      ctx.restore();
    }

    // 3) رسم الحافة السفلية المرئية فقط (الأمامية الخارجية + الخلفية داخل التجويف) والخطوط العمودية الفاصلة بين الشرائح
    donutSlices.forEach(function (sl) {
      // أ) القوس السفلي الخارجي (يظهر فقط في النصف الأمامي حيث sin(angle) >= 0 أي بين 0 و PI)
      var visStart = Math.max(0, Math.min(Math.PI, sl.start));
      var visEnd = Math.max(0, Math.min(Math.PI, sl.end));
      if (visEnd > visStart + 0.01) {
        ctx.save();
        ctx.translate(dCx, dCy + depth3D);
        ctx.scale(1, tiltY);
        ctx.beginPath();
        ctx.arc(0, 0, outerR, visStart, visEnd, false);
        ctx.strokeStyle = sl.rimColor;
        ctx.lineWidth = 2.6;
        ctx.stroke();
        ctx.restore();
      }

      // ب) خطوط الحواف العمودية الأمامية والداخلية بين الشرائح لإبراز المجسم ثلاثي الأبعاد
      [sl.start, sl.end].forEach(function (ang) {
        var sinVal = Math.sin(ang);
        var cosVal = Math.cos(ang);
        if (sinVal > 0.04) {
          // حافة عمودية على الجدار الخارجي الأمامي
          var vx = dCx + cosVal * outerR;
          var vyTop = dCy + sinVal * outerR * tiltY;
          ctx.beginPath();
          ctx.moveTo(vx, vyTop);
          ctx.lineTo(vx, vyTop + depth3D);
          ctx.strokeStyle = sl.rimColor;
          ctx.lineWidth = 1.6;
          ctx.stroke();
        } else if (sinVal < -0.04) {
          // حافة عمودية داخل جدار التجويف الأوسط الخلفي
          var vxIn = dCx + cosVal * innerR;
          var vyInTop = dCy + sinVal * innerR * tiltY;
          ctx.beginPath();
          ctx.moveTo(vxIn, vyInTop);
          ctx.lineTo(vxIn, vyInTop + depth3D);
          ctx.strokeStyle = sl.rimColor;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      });
    });

    // 4) رسم السطح العلوي للحلقة الدائرية ثلاثية الأبعاد مع تلوين الحواف (Top Beveled 3D Ring with Colored Edges)
    ctx.save();
    ctx.translate(dCx, dCy);
    ctx.scale(1, tiltY);
    donutSlices.forEach(function (sl) {
      ctx.beginPath();
      ctx.arc(0, 0, outerR, sl.start, sl.end, false);
      ctx.arc(0, 0, innerR, sl.end, sl.start, true);
      ctx.closePath();

      // تدرج إضاءة علوي يمنح السطح مظهر المجسم المحدب
      var grad = ctx.createRadialGradient(-outerR * 0.2, -outerR * 0.2, innerR * 0.4, 0, 0, outerR);
      if (sl.isRemaining) {
        grad.addColorStop(0, '#FFF5F7');
        grad.addColorStop(0.65, '#F3DCE2');
        grad.addColorStop(1, '#E2C2CB');
      } else {
        grad.addColorStop(0, shadeHexColor(sl.color, 1.22));
        grad.addColorStop(0.55, sl.color);
        grad.addColorStop(1, shadeHexColor(sl.color, 0.86));
      }
      ctx.fillStyle = grad;
      ctx.fill();

      // تلوين حواف كل شريحة بلون ثلاثي الأبعاد غامق ومميز من الحواف الخارجية والداخلية
      ctx.strokeStyle = sl.isRemaining ? '#9F7481' : shadeHexColor(sl.color, 0.52);
      ctx.lineWidth = 3.2;
      ctx.stroke();

      // لمعة الحافة الداخلية العلوية (3D Inner Specular Rim Highlight)
      ctx.beginPath();
      ctx.arc(0, 0, outerR - 2.2, sl.start + 0.01, sl.end - 0.01, false);
      ctx.strokeStyle = sl.isRemaining ? 'rgba(255,255,255,0.85)' : shadeHexColor(sl.color, 1.35);
      ctx.lineWidth = 1.4;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, innerR + 2.2, sl.start + 0.01, sl.end - 0.01, false);
      ctx.strokeStyle = sl.isRemaining ? '#B08592' : shadeHexColor(sl.color, 0.62);
      ctx.lineWidth = 2.0;
      ctx.stroke();
    });
    ctx.restore();

    // رسم خطوط الإشارة والتسميات والنسب المئوية المطابقة للأعمدة على يمين ويسار الدائرة
    var rightCallouts = [];
    var leftCallouts = [];
    donutSlices.forEach(function (sl) {
      if (sl.isRemaining) {
        leftCallouts.push(sl);
      } else if (Math.cos(sl.mid) >= -0.1) {
        rightCallouts.push(sl);
      } else {
        leftCallouts.push(sl);
      }
    });

    function drawCalloutList(list, isRightSide) {
      var count = list.length;
      if (!count) return;
      var minY = donutBoxY + 55;
      var maxY = donutBoxY + 465;
      var stepY = count > 1 ? Math.min(68, (maxY - minY) / (count - 1)) : 0;
      var startY = count === 1 ? (isRightSide ? donutBoxY + 70 : donutBoxY + 410) : (donutBoxY + 65);

      list.forEach(function (sl, idx) {
        var anchorX = dCx + Math.cos(sl.mid) * ((outerR + innerR) / 2);
        var anchorY = dCy + Math.sin(sl.mid) * ((outerR + innerR) / 2) * tiltY + (sl.isRemaining ? depth3D * 0.4 : 0);
        var labelY = sl.isRemaining && count === 1 ? (donutBoxY + 420) : (startY + idx * stepY);
        var edgeX = isRightSide ? (W - 76) : 76;
        var kneeX = isRightSide ? (dCx + outerR + 36) : (dCx - outerR - 36);

        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(anchorX, anchorY);
        ctx.lineTo(kneeX, labelY);
        ctx.lineTo(edgeX, labelY);
        ctx.stroke();

        ctx.fillStyle = '#64748B';
        ctx.beginPath();
        ctx.arc(anchorX, anchorY, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.textAlign = isRightSide ? 'right' : 'left';
        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 14.5px "Cairo", "IBM Plex Sans Arabic", sans-serif';
        ctx.fillText(sl.label, edgeX, labelY - 7);

        ctx.fillStyle = sl.isRemaining ? '#64748B' : '#15803D';
        ctx.font = 'bold 14px "Plus Jakarta Sans", "Cairo", sans-serif';
        ctx.fillText(sl.pctText, edgeX, labelY + 18);
      });
    }

    drawCalloutList(rightCallouts, true);
    drawCalloutList(leftCallouts, false);

    // أسفل الورقة:
    // - على اليسار: إطار مخصص للإمضاء والختم (بطلب الإدارة)
    // - على اليمين: جدول مطابقة النسب المئوية للمجالات أسفل الدائرة النسبية
    var stripY = donutBoxY + 492;
    var stripH = 156;

    // أ) مكان الإمضاء والختم في الأسفل على اليسار
    var stampBoxX = donutBoxX + 16; // 68
    var stampBoxW = 336;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(stampBoxX, stripY, stampBoxW, stripH);
    ctx.strokeStyle = '#1E3A8A';
    ctx.lineWidth = 1.6;
    ctx.strokeRect(stampBoxX, stripY, stampBoxW, stripH);

    // ترويسة صندوق الإمضاء والختم
    ctx.fillStyle = '#EEF2FF';
    ctx.fillRect(stampBoxX + 1, stripY + 1, stampBoxW - 2, 32);
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1;
    ctx.strokeRect(stampBoxX, stripY, stampBoxW, 32);

    ctx.fillStyle = '#1E1B4B';
    ctx.textAlign = 'center';
    ctx.font = 'bold 14.5px "Cairo", "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText('الإمضاء والختم', stampBoxX + stampBoxW / 2, stripY + 22);

    // مساحة فارغة مخصصة للتوقيع والختم الرسمي
    ctx.fillStyle = '#64748B';
    ctx.font = '12px "Cairo", "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText('تأشيرة وختم إدارة المركز النفسي البيداغوجي', stampBoxX + stampBoxW / 2, stripY + 54);
    ctx.strokeStyle = '#94A3B8';
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(stampBoxX + 18, stripY + 64, stampBoxW - 36, 78);
    ctx.setLineDash([]);

    // ب) جدول مطابقة النسب المئوية للمجالات على اليمين
    var domStripX = stampBoxX + stampBoxW + 14; // 418
    var domStripW = (donutBoxX + donutBoxW - 16) - domStripX; // 754
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(domStripX, stripY, domStripW, stripH);
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1;
    ctx.strokeRect(domStripX, stripY, domStripW, stripH);

    ctx.fillStyle = '#1E3A8A';
    ctx.textAlign = 'center';
    ctx.font = 'bold 13.5px "Cairo", "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText('نسب اكتساب المهارات حسب المجالات (مطابقة للأعمدة — معيار 4/5 فما فوق)', domStripX + domStripW / 2, stripY + 22);

    var colsPerRow = 2;
    var cellW = (domStripW - 16) / colsPerRow;
    var cellH = 26;

    domainStats.slice(0, 8).forEach(function (dm, idx) {
      var rIdx = Math.floor(idx / colsPerRow);
      var cIdx = idx % colsPerRow;
      var cxCell = (domStripX + domStripW - 8) - (cIdx + 1) * cellW;
      var cyCell = stripY + 30 + rIdx * (cellH + 4);

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(cxCell + 3, cyCell, cellW - 6, cellH);
      ctx.strokeStyle = '#E2E8F0';
      ctx.strokeRect(cxCell + 3, cyCell, cellW - 6, cellH);

      // نقطة لونية للمجال
      ctx.fillStyle = dm.color;
      ctx.beginPath();
      ctx.arc(cxCell + cellW - 13, cyCell + cellH / 2, 4.5, 0, Math.PI * 2);
      ctx.fill();

      // اسم المجال
      ctx.fillStyle = '#0F172A';
      ctx.textAlign = 'right';
      ctx.font = 'bold 11.5px "Cairo", "IBM Plex Sans Arabic", sans-serif';
      ctx.fillText(dm.shortName, cxCell + cellW - 22, cyCell + 18);

      // النسبة المئوية
      ctx.fillStyle = dm.acquired > 0 ? '#15803D' : '#64748B';
      ctx.textAlign = 'left';
      ctx.font = 'bold 11.5px "Plus Jakarta Sans", "Cairo", sans-serif';
      ctx.fillText(dm.pctFmt + '% (' + dm.acquired + '/' + dm.count + ')', cxCell + 8, cyCell + 18);
    });
  }

  // توليد عنصر Canvas لصفحة التقرير الكمي لعرضه مباشرة على شاشة الكمبيوتر أو طباعته
  async function renderQuantitativePageCanvas(rep, childFullName, secName, kd) {
    if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch (e) {}
    }
    var logoImg = await loadLogoImage();
    var statsObj = computeEvaluationStats(rep);
    var c = document.createElement('canvas');
    c.width = 1240;
    c.height = 1754;
    var ctx = c.getContext('2d');
    drawQuantitativeEvaluationPage(ctx, 1240, statsObj, childFullName, secName, kd, logoImg);
    return c;
  }

  async function renderReportToPdf(rep, child, secName, brName) {
    var logoImg = await loadLogoImage();
    var c = document.createElement('canvas');
    c.width = 1240;
    c.height = 1754;
    var ctx = c.getContext('2d');

    drawOfficialHeader(ctx, 1240, rep.title || 'تقرير تربوي وبيداغوجي', logoImg);

    var chName = (child && child.full_name) || 'غير محدد';
    var chMem = (child && child.membership_no) ? ('N° ' + child.membership_no) : '—';
    var rDate = rep.report_date || (rep.created_at ? rep.created_at.slice(0, 10) : '—');

    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(56, 220, 1240 - 112, 130);
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(56, 220, 1240 - 112, 130);

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 20px "IBM Plex Sans Arabic", "Cairo", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('اسم ولقب التلميذ(ة): ' + chName, 1240 - 80, 260);
    ctx.fillText('رقم القيد / العضوية: ' + chMem, 1240 - 80, 300);
    ctx.fillText('القسم / الفوج: ' + (secName || '—'), 1240 - 80, 335);

    ctx.fillText('الفرع / المركز: ' + (brName || 'المركز الرئيسي'), 580, 260);
    ctx.fillText('تاريخ التقرير: ' + rDate, 580, 300);
    ctx.fillText('طبيعة الإعاقة: ' + ((child && child.disability) || '—'), 580, 335);

    ctx.fillStyle = '#7DD3FC';
    ctx.fillRect(56, 370, 1240 - 112, 38);
    ctx.strokeRect(56, 370, 1240 - 112, 38);
    ctx.fillStyle = '#0F172A';
    ctx.textAlign = 'center';
    ctx.font = 'bold 20px "IBM Plex Sans Arabic", "Cairo", sans-serif';
    ctx.fillText('محتوى التقرير التربوي والملاحظات البيداغوجية', 1240 / 2, 396);

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(56, 415, 1240 - 112, 900);
    ctx.strokeRect(56, 415, 1240 - 112, 900);

    ctx.fillStyle = '#1E293B';
    ctx.font = '20px "IBM Plex Sans Arabic", "Cairo", sans-serif';
    ctx.textAlign = 'right';
    var text = rep.achievements ? ('الإنجازات: ' + rep.achievements + ' — الأنشطة: ' + (rep.activities || '') + ' — الملاحظات: ' + (rep.notes || '')) : (rep.content || rep.notes || rep.body || 'لا توجد ملاحظات إضافية.');
    var lines = wrapLines(ctx, text, 1240 - 160, 22);
    lines.forEach(function (ln, idx) {
      ctx.fillText(ln, 1240 - 80, 460 + idx * 36);
    });

    var jpg = await canvasToJpegBytes(c, 0.94);
    return buildPdfBinary([{ data: jpg, width: 1240, height: 1754 }]);
  }

  /* رسم استمارة التقييم البيداغوجي (notes | statistics | full) */
  
  /* ══════════════════════════════════════════════════════════════════════════
     تصدير استبانة تحديد المعززات إلى PDF بدقة A4 (مطابقة للوثيقة المرفقة)
     ══════════════════════════════════════════════════════════════════════════ */
  async function renderReinforcersToPdf(rep, childFullName, secName, kd) {
    var ev = ensureParsedEval(rep);
    var rf = ev.reinforcers || {};
    var items = rf.items || {};
    var custom = rf.custom_items || {};
    var logoImg = await loadLogoImage();

    var W = 1240, H = 1754, M = 56, CW = W - M * 2;
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var ctx = c.getContext('2d');

    // خلفية وإطار A4
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#163B65';
    ctx.lineWidth = 3;
    ctx.strokeRect(M - 10, M - 10, CW + 20, H - (M - 10) * 2);

    drawOfficialHeader(ctx, W, 'استبيان تقييم المعززات', logoImg);

    var y = 220;
    // بطاقة معلومات المفحوص
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(M, y, CW, 80);
    ctx.strokeStyle = '#163B65';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(M, y, CW, 80);

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 18px "IBM Plex Sans Arabic", "Cairo", sans-serif';
    ctx.textAlign = 'right';
    var chName = childFullName || (kd && kd.full_name) || 'غير محدد';
    var dobStr = rf.dob || (kd && kd.dob) || '—';
    var interviewer = rf.interviewer || 'مدير المركز';
    var ivDate = rf.interview_date || ev.report_date || '—';

    ctx.fillText('اسم المفحوص: ' + chName, W - M - 20, y + 32);
    ctx.fillText('القائم بالمقابلة: ' + interviewer, W - M - 20, y + 64);
    ctx.fillText('تاريخ الميلاد: ' + dobStr, M + CW / 2 - 20, y + 32);
    ctx.fillText('تاريخ المقابلة: ' + ivDate, M + CW / 2 - 20, y + 64);

    y += 95;

    // نص التعليمات
    ctx.fillStyle = '#EFF6FF';
    ctx.fillRect(M, y, CW, 70);
    ctx.strokeStyle = '#93C5FD';
    ctx.lineWidth = 1;
    ctx.strokeRect(M, y, CW, 70);
    ctx.fillStyle = '#1E3A8A';
    ctx.font = '14px "IBM Plex Sans Arabic", "Cairo", sans-serif';
    ctx.fillText('عزيزي المطبق: الهدف من هذه الاستبانة تحديد المعززات التي يرغب فيها الشخص لاستخدامها في تعديل السلوك أو التدريب.', W - M - 16, y + 26);
    ctx.fillText('يرجى وضع علامة (✔) في الخانة التي تعبر عن درجة الرغبة في المعزز (شديدة / متوسطة / قليلة)، وتدوين المعززات الأخرى.', W - M - 16, y + 50);

    y += 85;

    // رسم جدول المعززات
    var colW_Name = CW * 0.52;
    var colW_Opt = CW * 0.16;

    // رأس الجدول
    ctx.fillStyle = '#163B65';
    ctx.fillRect(M, y, CW, 36);
    ctx.strokeStyle = '#163B65';
    ctx.strokeRect(M, y, CW, 36);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px "IBM Plex Sans Arabic", "Cairo", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('المعزز المطلوب تقييمه', W - M - 16, y + 24);

    ctx.textAlign = 'center';
    ctx.fillText('شديدة', M + colW_Opt * 2.5, y + 24);
    ctx.fillText('متوسطة', M + colW_Opt * 1.5, y + 24);
    ctx.fillText('قليلة', M + colW_Opt * 0.5, y + 24);

    y += 36;

    var reinCats = [
      { cat: 'المعززات الغذائية', items: ['فواكه', 'شيكولاتة', 'خضار خيار', 'بسكويت', 'عيش', 'ماء', 'مشروبات غازية', 'لبن', 'عصير', 'قهوة', 'أخرى (غذائية)'] },
      { cat: 'المعززات الإجتماعية', items: ['الإبتسام', 'الكلمات التشجيعية', 'الثناء', 'الانتباه', 'أخرى (اجتماعية)'] },
      { cat: 'المعززات المادية', items: ['قطار', 'حافلة', 'مكعبات', 'هواتف', 'أخرى (مادية)'] },
      { cat: 'المعززات الرمزية', items: ['النقاط', 'النجوم', 'الكوبانات', 'أخرى (رمزية)'] },
      { cat: 'المعززات النشاطية', items: ['برنامج تلفزيونى مفضل', 'اللعب بالكرة', 'الخروج مع الأصدقاء', 'الزيارات', 'الرحلات', 'الرسم', 'السباحة', 'الجرى'] },
      { cat: 'معززات جسدية', items: ['الأحضان', 'القبلات', 'الربت على الكتف', 'السلام باليد (Give me five)', 'الدغدغة باليد'] }
    ];

    var rowH = 26;
    ctx.font = '14px "IBM Plex Sans Arabic", "Cairo", sans-serif';

    reinCats.forEach(function (catObj, cIdx) {
      if (y + rowH > H - 180) return;
      // سطر الفئة
      ctx.fillStyle = '#DCFCE7';
      ctx.fillRect(M, y, CW, rowH);
      ctx.strokeStyle = '#CBD5E1';
      ctx.strokeRect(M, y, CW, rowH);
      ctx.fillStyle = '#163B65';
      ctx.font = 'bold 15px "IBM Plex Sans Arabic", "Cairo", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('● ' + catObj.cat, W - M - 12, y + 18);
      y += rowH;

      ctx.font = '13.5px "IBM Plex Sans Arabic", "Cairo", sans-serif';
      catObj.items.forEach(function (itName, iIdx) {
        if (y + rowH > H - 180) return;
        var key = cIdx + '_' + iIdx;
        var chosen = items[key] || '';
        var isOther = itName.indexOf('أخرى') >= 0;
        var disp = isOther && custom[key] ? (itName + ': ' + custom[key]) : itName;

        ctx.fillStyle = (iIdx % 2 === 0 ? '#FFFFFF' : '#F8FAFC');
        ctx.fillRect(M, y, CW, rowH);
        ctx.strokeStyle = '#E2E8F0';
        ctx.strokeRect(M, y, CW, rowH);

        // خطوط الأعمدة
        ctx.strokeRect(M + colW_Opt * 2, y, colW_Opt, rowH);
        ctx.strokeRect(M + colW_Opt, y, colW_Opt, rowH);
        ctx.strokeRect(M, y, colW_Opt, rowH);

        ctx.fillStyle = '#0F172A';
        ctx.textAlign = 'right';
        ctx.fillText(disp, W - M - 12, y + 18);

        ctx.textAlign = 'center';
        ctx.font = 'bold 16px sans-serif';
        if (chosen === 'شديدة') { ctx.fillStyle = '#2563EB'; ctx.fillText('✔', M + colW_Opt * 2.5, y + 19); }
        if (chosen === 'متوسطة') { ctx.fillStyle = '#D97706'; ctx.fillText('✔', M + colW_Opt * 1.5, y + 19); }
        if (chosen === 'قليلة') { ctx.fillStyle = '#64748B'; ctx.fillText('✔', M + colW_Opt * 0.5, y + 19); }
        ctx.font = '13.5px "IBM Plex Sans Arabic", "Cairo", sans-serif';

        y += rowH;
      });
    });

    // التوقيعات أسفل الصفحة
    var footY = H - 120;
    ctx.strokeStyle = '#163B65';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(M, footY);
    ctx.lineTo(W - M, footY);
    ctx.stroke();

    ctx.fillStyle = '#1E293B';
    ctx.font = 'bold 13px "IBM Plex Sans Arabic", "Cairo", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('• يتم التقييم للمعززات من خلال: 1- الملاحظة المباشرة  2- المقابلة مع الوالدين  3- سؤال الفرد نفسه.', W - M - 10, footY - 30);
    ctx.fillText('• مواصفات المعزز الفعال: فورية وتنوع التعزيز، جدول التعزيز، مستوى الحرمان، والتعزيز الطبيعي أفضل من الصناعي.', W - M - 10, footY - 10);
    ctx.font = '12px "IBM Plex Sans Arabic", "Cairo", sans-serif';
    ctx.fillText('• ملاحظات: المعززات النشاطية تستند لمبدأ بريماك باستخدام سلوك محبب في تعزيز سلوك نادراً ما يقوم به الطفل.', W - M - 10, footY + 10);

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 16px "IBM Plex Sans Arabic", "Cairo", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ختم وتوقيع مدير المركز', M + 180, footY + 28);

    var jpg = await canvasToJpegBytes(c, 0.95);
    return buildPdfBinary([{ data: jpg, width: W, height: H }]);
  }

  /* ══════════════════════════════════════════════════════════════════════════
     تصدير شبكة المقابلة والفحص إلى PDF بدقة A4 (مطابقة لـ 4_5836912541548156736.pdf)
     ══════════════════════════════════════════════════════════════════════════ */
  async function renderInterviewDiagnosticToPdf(rep, childFullName, secName, kd) {
    var ev = ensureParsedEval(rep);
    var iv = ev.interview || {};
    var logoImg = await loadLogoImage();

    var W = 1240, H = 1754, M = 56, CW = W - M * 2;
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var ctx = c.getContext('2d');

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#163B65';
    ctx.lineWidth = 3;
    ctx.strokeRect(M - 10, M - 10, CW + 20, H - (M - 10) * 2);

    drawOfficialHeader(ctx, W, 'شبكة المقابلة والفحص البيداغوجي والنفسي', logoImg);

    var y = 220;
    function drawSecHead(num, title) {
      ctx.fillStyle = '#163B65';
      ctx.fillRect(M, y, CW, 30);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 15px "IBM Plex Sans Arabic", "Cairo", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(num + '- ' + title, W - M - 12, y + 21);
      y += 34;
    }

    // 1- تقديم الحالة
    drawSecHead('1', 'تقديم الحالة:');
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(M, y, CW, 100);
    ctx.strokeStyle = '#CBD5E1';
    ctx.strokeRect(M, y, CW, 100);

    ctx.fillStyle = '#0F172A';
    ctx.font = '14px "IBM Plex Sans Arabic", "Cairo", sans-serif';
    ctx.textAlign = 'right';
    var chName = childFullName || (kd && kd.full_name) || iv.fullname || '—';
    var dobStr = iv.dob || (kd && kd.dob) || '—';
    ctx.fillText('الاسم واللقب: ' + chName, W - M - 16, y + 26);
    ctx.fillText('تاريخ الميلاد: ' + dobStr, W - M - 16, y + 54);
    ctx.fillText('الجنس: ' + (iv.gender || 'ذكر') + '  |  السن: ' + (iv.age || '—'), W - M - 16, y + 82);

    ctx.fillText('العنوان: ' + (iv.address || (kd && kd.address) || 'غرداية'), M + CW / 2 - 16, y + 26);
    ctx.fillText('المستوى التعليمي: ' + (iv.education_level || secName || '—'), M + CW / 2 - 16, y + 54);
    ctx.fillText('اللغة المستعملة: ' + (iv.language || 'العربية') + '  |  تاريخ الالتحاق: ' + (iv.join_date || '2024-09-15'), M + CW / 2 - 16, y + 82);

    y += 112;

    // 2- دوافع الفحص
    drawSecHead('2', 'دوافع الفحص:');
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '14.5px "IBM Plex Sans Arabic", "Cairo", sans-serif';
    var motDoc = (iv.motive_doctor ? '[✔] ' : '[ ] ') + 'الطبيب';
    var motCase = (iv.motive_case ? '[✔] ' : '[ ] ') + 'الحالة';
    var motFam = (iv.motive_family ? '[✔] ' : '[ ] ') + 'الأسرة';
    ctx.fillText('من الذي طلب إجراء الفحص؟    ' + motDoc + '      ' + motCase + '      ' + motFam, W - M - 16, y + 16);
    y += 32;

    // 3 & 4- السوابق
    drawSecHead('3 & 4', 'السوابق المرضية الشخصية والعائلية:');
    var sLines = [
      ['- هل تعرضت الحالة لصدمة دماغية؟', iv.past_stroke || 'لا'],
      ['- هل للحالة سوابق عقلية؟', iv.past_mental || 'لا'],
      ['- هل تعاني الحالة من أمراض معينة؟ ' + (iv.past_diseases_text ? ('(' + iv.past_diseases_text + ')') : ''), iv.past_diseases || 'لا'],
      ['- هل أصيب أحد الأقارب بالخرف؟ (السوابق العائلية)', iv.family_dementia || 'لا']
    ];
    sLines.forEach(function (ln) {
      ctx.fillStyle = '#0F172A';
      ctx.textAlign = 'right';
      ctx.fillText(ln[0], W - M - 16, y + 16);
      ctx.textAlign = 'left';
      ctx.font = 'bold 14px "IBM Plex Sans Arabic", sans-serif';
      ctx.fillText(ln[1], M + 30, y + 16);
      ctx.font = '14px "IBM Plex Sans Arabic", "Cairo", sans-serif';
      y += 24;
    });
    y += 10;

    // 5 & 6- نتائج الفحوصات وتاريخ المرض
    drawSecHead('5 & 6', 'نتائج الفحوصات وتاريخ المرض:');
    ctx.fillText('- الفحص العصبي: ' + (iv.neuro_exam || 'طبيعي') + '   |   الفحص البيولوجي: ' + (iv.bio_exam || 'طبيعي'), W - M - 16, y + 16);
    y += 24;
    ctx.fillText('- تاريخ بداية المرض: ' + (iv.disease_start_date || 'منذ الولادة') + '   |   الأدوية: ' + (iv.takes_medication || 'لا'), W - M - 16, y + 16);
    y += 34;

    // 7- تاريخ الاضطرابات المعرفية والنفسية
    drawSecHead('7', 'تاريخ الاضطرابات المعرفية والنفسية:');
    var cLines = [
      '- اضطرابات الذاكرة: ظهور: ' + (iv.memory_onset || 'تدريجا') + ' • مواضع الأشياء: ' + (iv.memory_places || 'نعم') + ' • المواعيد: ' + (iv.memory_appointments || 'نعم'),
      '- اضطرابات اللغة: نقص الكلمة: ' + (iv.lang_anomia || 'لا') + ' • فحص الكلام: ' + (iv.lang_speech_quality || 'تعبير سليم نسبياً'),
      '- التوجه الزماني والمكاني: التباس الأيام: ' + (iv.time_days || 'لا') + ' • التباس الوقت: ' + (iv.time_hours || 'لا') + ' • تيهان: ' + (iv.space_center || 'لا'),
      '- الأبراكسيا والأقنوزيا: الثياب: ' + (iv.apraxia_clothes || 'لا') + ' • الطعام: ' + (iv.apraxia_eating || 'لا') + ' • الوجوه المألوفة: ' + (iv.agnosia_faces || 'نعم'),
      '- النوم والحالة النفسية: صعوبة النوم: ' + (iv.sleep_difficulty || 'لا') + ' • الاستيقاظ ليلاً: ' + (iv.sleep_night_waking || 'لا') + ' • تغيرات نفسية: ' + (iv.psych_changes || 'لا'),
      '- الجانب العلائقي الاجتماعي: ' + (iv.social_relationships || 'تفاعل إيجابي مع المربيات والأقران')
    ];
    cLines.forEach(function (ln) {
      ctx.fillText(ln, W - M - 16, y + 16);
      y += 24;
    });
    y += 10;

    // تعليق المختص
    drawSecHead('•', 'تعليق المختص العام:');
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(M, y, CW, 70);
    ctx.strokeStyle = '#CBD5E1';
    ctx.strokeRect(M, y, CW, 70);
    ctx.fillStyle = '#0F172A';
    ctx.font = '14px "IBM Plex Sans Arabic", "Cairo", sans-serif';
    ctx.fillText(iv.expert_comment || 'الحالة تظهر استجابة مشجعة للتأهيل والمرافقة المستمرة بدار الإحسان.', W - M - 16, y + 26);

    y = H - 120;
    ctx.strokeStyle = '#163B65';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(M, y);
    ctx.lineTo(W - M, y);
    ctx.stroke();

    ctx.fillStyle = '#475569';
    ctx.font = '13px "IBM Plex Sans Arabic", "Cairo", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('حرر بدار الإحسان في: ' + (iv.exam_date || ev.report_date || '—'), W - M - 10, y + 28);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 16px "IBM Plex Sans Arabic", "Cairo", sans-serif';
    ctx.fillText('ختم المركز وتوقيع الأخصائي', M + 180, y + 28);

    var jpg = await canvasToJpegBytes(c, 0.95);
    return buildPdfBinary([{ data: jpg, width: W, height: H }]);
  }

  /* ══════════════════════════════════════════════════════════════════════════
     تصدير التقرير النهائي لمتابعة الطالب إلى PDF بدقة A4 (مطابق لـ 59548.jpg)
     ══════════════════════════════════════════════════════════════════════════ */
  async function renderAnnualFinalToPdf(rep, childFullName, secName, kd) {
    var ev = ensureParsedEval(rep);
    var af = ev.annual_final || {};
    var W = 1240, H = 1754, M = 70, CW = W - M * 2;
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var ctx = c.getContext('2d');

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(M - 15, M - 15, CW + 30, H - (M - 15) * 2);

    var y = M + 40;
    var chName = childFullName || (kd && kd.full_name) || 'الطالب';

    // العنوان الرئيسي مسطر
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 24px "IBM Plex Sans Arabic", "Cairo", sans-serif';
    ctx.textAlign = 'center';
    // رسم شعار المركز أعلى التقرير
    var logoImg = await loadLogoImage();
    if (logoImg && logoImg.width) {
      ctx.drawImage(logoImg, W - M - 70, y - 20, 65, 65);
    }
    var mainTitle = 'التقرير النهائي لمتابعة الطالب ' + chName + ' حفظه الله';
    ctx.fillText(mainTitle, W / 2, y);
    var textMetrics = ctx.measureText(mainTitle);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(W / 2 - textMetrics.width / 2, y + 8);
    ctx.lineTo(W / 2 + textMetrics.width / 2, y + 8);
    ctx.stroke();

    y += 50;

    // المخاطبة
    ctx.font = 'bold 20px "IBM Plex Sans Arabic", "Cairo", sans-serif';
    ctx.fillText('المكرم ولي أمر / الطالب', W / 2, y);
    y += 30;
    ctx.fillText(af.parent_name || 'مصطفى', W / 2, y);
    y += 38;

    // السلام عليكم
    ctx.font = 'bold 18px "IBM Plex Sans Arabic", "Cairo", sans-serif';
    ctx.fillText('السلام عليكم ورحمة الله وبركاته', W / 2, y);
    y += 32;

    // النص التمهيدي
    ctx.font = '16px "IBM Plex Sans Arabic", "Cairo", sans-serif';
    ctx.textAlign = 'right';
    var intro1 = 'في إطار متابعة المسار التربوي لأبنائكم، نحيطكم علما بأنه تم حصر مختلف المهارات التي تم تدريب ابنكم عليها خلال الموسم';
    var intro2 = 'الدراسي ' + (af.school_year || '2025/2026') + '، وذلك لتمكينكم من الاطلاع عليها وتعزيز متابعتها خلال العطلة الصيفية. ويأتي هذا في سياق التعاون';
    var intro3 = 'المستمر بين الأسرة والمركز، وحرصا على المحافظة على المكتسبات وضمان استمرارية البرنامج التربوي بما يساهم في تحقيق الأهداف.';
    ctx.fillText(intro1, W - M, y); y += 26;
    ctx.fillText(intro2, W - M, y); y += 26;
    ctx.fillText(intro3, W - M, y); y += 38;

    // • الحالة الانضباطية:
    ctx.font = 'bold 19px "IBM Plex Sans Arabic", "Cairo", sans-serif';
    ctx.fillText('• الحالة الانضباطية:', W - M, y); y += 28;
    ctx.font = 'bold 17px "IBM Plex Sans Arabic", "Cairo", sans-serif';
    ctx.fillText('نظام الحصص في الأسبوع للحالة:', W - M, y); y += 30;

    // مربعات نظام الحصص (1/5 إلى 5/5)
    var curRatio = af.weekly_ratio || '3/5';
    var ratios = ['1/5', '2/5', '3/5', '4/5', '5/5'];
    var rSpacing = CW / 5;
    ctx.font = 'bold 16px "IBM Plex Sans Arabic", "Cairo", sans-serif';
    ratios.forEach(function (rVal, idx) {
      var rx = W - M - idx * rSpacing;
      var isChosen = (curRatio === rVal);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.strokeRect(rx - 18, y - 16, 18, 18);
      if (isChosen) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(rx - 18, y - 16, 18, 18);
      }
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'right';
      ctx.fillText(rVal + ' حصص', rx - 26, y - 1);
    });

    y += 36;

    // جدول الحصص والأحجام الساعية
    var colW = CW / 5;
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(M, y, CW, 50);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(M, y, CW, 100);

    ctx.fillStyle = '#000000';
    ctx.font = 'bold 15px "IBM Plex Sans Arabic", "Cairo", sans-serif';
    ctx.textAlign = 'center';

    var ths = [
      'الحصص الفردية\nالسنوية المفروضة',
      'الحجم الساعي\nالسنوي المقابل',
      'الحصص الفردية\nالمستغلة',
      'الحجم الساعي\nالمقابل',
      'الحجم الساعي السنوي\nغير المستغل'
    ];

    ths.forEach(function (thText, idx) {
      var colX = W - M - (idx + 0.5) * colW;
      var lines = thText.split('\n');
      ctx.fillText(lines[0], colX, y + 20);
      if (lines[1]) ctx.fillText(lines[1], colX, y + 38);
      ctx.strokeRect(W - M - (idx + 1) * colW, y, colW, 50);
      ctx.strokeRect(W - M - (idx + 1) * colW, y + 50, colW, 50);
    });

    // قيم الجدول
    var valY = y + 80;
    ctx.font = 'bold 17px "IBM Plex Sans Arabic", "Cairo", sans-serif';
    ctx.fillStyle = '#000000';
    ctx.fillText((af.prescribed_sessions != null ? af.prescribed_sessions : 54) + ' حصة', W - M - 0.5 * colW, valY);
    ctx.fillText((af.prescribed_hours != null ? af.prescribed_hours : 770) + ' ساعة', W - M - 1.5 * colW, valY);
    ctx.fillText((af.utilized_sessions != null ? af.utilized_sessions : 47) + ' حصة', W - M - 2.5 * colW, valY);
    ctx.fillText((af.utilized_hours != null ? af.utilized_hours : 760) + '', W - M - 3.5 * colW, valY);
    ctx.fillStyle = '#DC2626'; // أحمر بارز للحجم غير المستغل
    ctx.fillText((af.unspent_hours != null ? af.unspent_hours : 10) + ' ساعة', W - M - 4.5 * colW, valY);

    y += 120;

    // • ملاحظات (مظللة بالأصفر الفاقع كما في الصورة)
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 19px "IBM Plex Sans Arabic", "Cairo", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('• ملاحظات:', W - M, y); y += 26;

    var notesText = af.pedagogical_notes || 'الحالة تستجيب للتدريب وتظهر قابلية للتحسن التدريجي، خاصة عند توفير بيئة تربوية منظمة، دعم مستمر، وتعاون فعال بين الأسرة والمختصين وأعانكم الله.';
    ctx.fillStyle = '#FEF08A'; // أصفر فاقع
    ctx.fillRect(M, y, CW, 50);
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 16px "IBM Plex Sans Arabic", "Cairo", sans-serif';
    ctx.fillText(notesText, W - M - 12, y + 32);

    y += 72;

    // • ملاحظات الإدارة:
    ctx.font = 'bold 19px "IBM Plex Sans Arabic", "Cairo", sans-serif';
    ctx.fillText('• ملاحظات الإدارة:', W - M, y); y += 28;

    ctx.font = '16px "IBM Plex Sans Arabic", "Cairo", sans-serif';
    var admAbs = '*الغياب: ' + (af.admin_absence || '02 يوم');
    var admHyg = '*النظافة العامة: ' + (af.admin_hygiene || 'جيدة');
    var admCnt = '*التواصل مع المركز: ' + (af.admin_contact || 'جيد');
    var admRsp = '*الاستجابة إلى الدعوات: ' + (af.admin_response || 'جيد');
    ctx.fillText(admAbs + '     ' + admHyg + '     ' + admCnt + '     ' + admRsp, W - M, y);

    y += 40;

    // • التذكير ببعض الالتزامات منها:
    ctx.font = 'bold 18px "IBM Plex Sans Arabic", "Cairo", sans-serif';
    ctx.fillText('• التذكير ببعض الالتزامات منها:', W - M, y); y += 26;

    ctx.font = '14.5px "IBM Plex Sans Arabic", "Cairo", sans-serif';
    var commitments = [
      '• احترام النظام الداخلي لتعهد الولي كاملا والعمل به.',
      '• دفع الاشتراك السنوي حسب الاتفاق المبرم مع الإدارة.',
      '• حضور اللقاءات والجلسات التكوينية المبرمجة مع الأولياء الفردية والجماعية وحسب الأفواج.',
      '• متابعة الخطة العلاجية للطفل والمرافقة الوالدية خلال الموسم الدراسي والعطل.',
      '• المشاركة في العمل التطوعي والأنشطة اللاصفية المبرمجة للأبناء وأوليائهم.',
      '• المساهمة ماديا ومعنويا لرفع من درجة الوعي لدى الأولياء للتكفل ومرافقة أبنائهم.',
      '• التواصل الدائم مع الإدارة والطاقم التربوي المتخصص في المجال.',
      '• تجديد تسجيل الطفل المتمدرس بالمركز نهاية كل موسم دراسي.'
    ];

    commitments.forEach(function (cText) {
      ctx.fillText(cText, W - M - 8, y);
      y += 22;
    });

    y += 18;

    // التعهد
    ctx.font = 'bold 16px "IBM Plex Sans Arabic", "Cairo", sans-serif';
    ctx.fillText('ألتزم بما اطلعت عليه للموسم الدراسي المقبل ' + (af.school_year || '2025/2026'), W - M, y);
    ctx.textAlign = 'left';
    ctx.fillText('الاسم اللقب: ....................................................', M + 20, y);

    y += 45;

    // توقيع وختم مدير المركز فقط
    ctx.textAlign = 'center';
    ctx.font = 'bold 18px "IBM Plex Sans Arabic", "Cairo", sans-serif';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    var sBoxW = 280, sBoxH = 75;
    ctx.strokeRect(W / 2 - sBoxW / 2, y - 25, sBoxW, sBoxH);
    ctx.fillText('توقيع وختم مدير المركز', W / 2, y + 2);
    ctx.font = '13px "IBM Plex Sans Arabic", "Cairo", sans-serif';
    ctx.fillStyle = '#475569';
    ctx.fillText('التأشيرة والختم الرسمي لدار الإحسان', W / 2, y + 36);

    var jpg = await canvasToJpegBytes(c, 0.95);
    return buildPdfBinary([{ data: jpg, width: W, height: H }]);
  }


  async function renderEvaluationToPdf(rep, childFullName, secName, kd, reportType) {
    reportType = reportType || 'full';
    var evObj = ensureParsedEval(rep);
    if (evObj && evObj.eval_type === 'reinforcers') {
      return renderReinforcersToPdf(rep, childFullName, secName, kd);
    }
    if (evObj && evObj.eval_type === 'interview_diagnostic') {
      return renderInterviewDiagnosticToPdf(rep, childFullName, secName, kd);
    }
    if (evObj && evObj.eval_type === 'annual_final') {
      return renderAnnualFinalToPdf(rep, childFullName, secName, kd);
    }
    if (evObj && evObj.eval_type === 'target_behavior') {
      return renderTargetBehaviorToPdf(rep, childFullName, secName, kd);
    }
    if (evObj && evObj.eval_type === 'target_behavior_report') {
      return renderTargetBehaviorReportToPdf(rep, childFullName, secName, kd);
    }
    if (evObj && (evObj.eval_type === 'mas_behavior' || evObj.eval_type === 'mas')) {
      return renderMasBehaviorToPdf(rep, childFullName, secName, kd);
    }
    if (evObj && evObj.eval_type === 'mas_behavior_report') {
      return renderMasBehaviorReportToPdf(rep, childFullName, secName, kd);
    } // 'notes' | 'statistics' | 'full'
    if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch (e) {}
    }
    var reportTemplateVersion = 'DE-EVAL-2.0';
    var generatedAtText = new Date().toLocaleString('ar-DZ', {
      timeZone: 'Africa/Algiers', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false
    });

    var statsObj = computeEvaluationStats(rep);
    var ev = statsObj.ev;
    var domainStats = statsObj.domainStats;
    var logoImg = await loadLogoImage();
    var W = 1240;
    var M = 56;
    var CW = W - M * 2; // 1128

    // حساب العمر وتاريخ الميلاد مع دعم الحقول المحفوظة داخل التقييم مباشرة
    var ageTxt = '—';
    var dobFmt = '—';
    var rawChildDob = (kd && kd.dob) || ev.dob || '';
    if (rawChildDob) {
      var mDob = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(rawChildDob).trim());
      if (mDob) {
        dobFmt = mDob[1] + '/' + mDob[2] + '/' + mDob[3];
        var age = new Date().getFullYear() - parseInt(mDob[1], 10);
        if (age > 0) ageTxt = age + ' سنة';
      } else {
        dobFmt = String(rawChildDob);
      }
    }
    var resolvedChildName = childFullName || (kd && kd.full_name) || ev.child_name || '—';
    var resolvedDisability = (kd && kd.disability) || ev.disability || '—';
    var resolvedSection = ev.qualification_level || secName || (kd && kd.section) || ev.section_name || '—';

    var pages = [];
    function newPage(title) {
      var c = document.createElement('canvas');
      c.width = W;
      c.height = 1754;
      var ctx = c.getContext('2d');
      drawOfficialHeader(ctx, W, title, logoImg);
      var pObj = { canvas: c, ctx: ctx, y: 208 };
      pages.push(pObj);
      return pObj;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // القسم الأول: تقرير نوعي تحليلي (Rapport d'analyse qualitatif)
    // يُرسم عندما يكون reportType === 'notes' أو 'full'
    // مضبوط بدقة ليبقى داخل صفحة A4 واحدة دون تجاوزها أبداً
    // ══════════════════════════════════════════════════════════════════════════
    if (reportType === 'notes' || reportType === 'full') {
      var pNotes = newPage("تقرير نوعي تحليلي (Rapport d'analyse qualitatif)");
      var ctx = pNotes.ctx;
      var y = pNotes.y;

      // 1. البانر الذهبي للثلاثي والموسم
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(M, y, CW, 36);
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(M, y, CW, 36);
      ctx.fillStyle = '#0F172A';
      ctx.textAlign = 'center';
      ctx.font = 'bold 20px "IBM Plex Sans Arabic", "Cairo", sans-serif';
      ctx.fillText('تقييم ' + (ev.term || 'الثلاثي الأخير') + ' للموسم الدراسي: ' + (ev.school_year || '2024/2025'), W / 2, y + 25);
      y += 44;

      // 2. جدول معلومات الحالة (4 أعمدة)
      var c1W = 180, c2W = 384, c3W = 180, c4W = 384;
      var x1 = W - M - c1W;
      var x2 = x1 - c2W;
      var x3 = x2 - c3W;
      var x4 = M;

      var infoRows = [
        ['اسم ولقب الحالة:', resolvedChildName, 'العمر:', ageTxt],
        ['نوع الاضطراب:', resolvedDisability, 'تاريخ الميلاد:', dobFmt],
        ['درجة الإعاقة / الاضطراب:', ev.degree_of_disability || 'متوسطة', 'القسم ومستوى التأهيل:', resolvedSection]
      ];

      infoRows.forEach(function (row) {
        var rh = 34;
        ctx.fillStyle = '#F8FAFC';
        ctx.fillRect(x1, y, c1W, rh);
        ctx.fillRect(x3, y, c3W, rh);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x2, y, c2W, rh);
        ctx.fillRect(x4, y, c4W, rh);

        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;
        ctx.strokeRect(x1, y, c1W, rh);
        ctx.strokeRect(x2, y, c2W, rh);
        ctx.strokeRect(x3, y, c3W, rh);
        ctx.strokeRect(x4, y, c4W, rh);

        ctx.fillStyle = '#0F172A';
        ctx.textAlign = 'right';
        ctx.font = 'bold 16px "IBM Plex Sans Arabic", "Cairo", sans-serif';
        ctx.fillText(row[0], x1 + c1W - 10, y + 23);
        ctx.fillText(row[2], x3 + c3W - 10, y + 23);

        ctx.textAlign = 'center';
        ctx.font = 'bold 16px "IBM Plex Sans Arabic", "Cairo", sans-serif';
        ctx.fillText(String(row[1]), x2 + c2W / 2, y + 23);
        ctx.fillText(String(row[3]), x4 + c4W / 2, y + 23);
        y += rh;
      });
      y += 10;

      // 3. جدول المشرفين (بحد أقصى 4 صفوف للحفاظ على مقاس صفحة A4)
      var sW1 = 488, sW2 = 320, sW3 = 320;
      var sx1 = W - M - sW1;
      var sx2 = sx1 - sW2;
      var sx3 = M;

      ctx.fillStyle = '#F1F5F9';
      ctx.fillRect(sx1, y, sW1, 32);
      ctx.fillRect(sx2, y, sW2, 32);
      ctx.fillRect(sx3, y, sW3, 32);
      ctx.strokeStyle = '#334155';
      ctx.strokeRect(sx1, y, sW1, 32);
      ctx.strokeRect(sx2, y, sW2, 32);
      ctx.strokeRect(sx3, y, sW3, 32);

      ctx.fillStyle = '#0F172A';
      ctx.textAlign = 'center';
      ctx.font = 'bold 15.5px "IBM Plex Sans Arabic", "Cairo", sans-serif';
      ctx.fillText('المشرفون: الإسم واللقب', sx1 + sW1 / 2, y + 22);
      ctx.fillText('الوظيفة / التخصص', sx2 + sW2 / 2, y + 22);
      ctx.fillText('التوقيع والختم', sx3 + sW3 / 2, y + 22);
      y += 32;

      var sups = (ev.supervisors && ev.supervisors.length) ? ev.supervisors : [{ name: 'إدارة المركز', role: 'مدير المركز' }];
      sups.slice(0, 4).forEach(function (sp) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(sx1, y, sW1, 30);
        ctx.fillRect(sx2, y, sW2, 30);
        ctx.fillRect(sx3, y, sW3, 30);
        ctx.strokeRect(sx1, y, sW1, 30);
        ctx.strokeRect(sx2, y, sW2, 30);
        ctx.strokeRect(sx3, y, sW3, 30);

        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 15px "IBM Plex Sans Arabic", "Cairo", sans-serif';
        ctx.fillText(sp.name || '—', sx1 + sW1 / 2, y + 21);
        ctx.font = '15px "IBM Plex Sans Arabic", "Cairo", sans-serif';
        ctx.fillText(sp.role || '—', sx2 + sW2 / 2, y + 21);
        ctx.fillStyle = '#64748B';
        ctx.fillText('........................', sx3 + sW3 / 2, y + 21);
        y += 30;
      });
      y += 14;

      // 4. البانر الأزرق السماوي: الوصف العام لأداء الحالة
      ctx.fillStyle = '#7DD3FC';
      ctx.fillRect(M, y, CW, 36);
      ctx.strokeStyle = '#0284C7';
      ctx.strokeRect(M, y, CW, 36);
      ctx.fillStyle = '#0F172A';
      ctx.textAlign = 'center';
      ctx.font = 'bold 19px "IBM Plex Sans Arabic", "Cairo", sans-serif';
      ctx.fillText('الوصف العام لأداء الحالة', W / 2, y + 25);
      y += 44;

      // 5. شبكة الوصف العام (ديناميكية بالكامل بدون فراغات زائدة وبدون تقييد للكتابة)
      var colGap = 14;
      var halfW = (CW - colGap) / 2; // 557
      var rightColX = W - M - halfW;
      var leftColX = M;

      ctx.font = '15.5px "IBM Plex Sans Arabic", "Cairo", sans-serif';
      var grText = (ev.general_report && String(ev.general_report).trim()) ? String(ev.general_report).trim() : '—';
      var grAllLines = [];
      grText.replace(/\r\n/g, '\n').split('\n').forEach(function (p) {
        if (!p.trim()) return;
        grAllLines = grAllLines.concat(wrapLines(ctx, p.trim(), halfW - 26, 0));
      });
      if (!grAllLines.length) grAllLines = ['—'];
      var grContentH = Math.max(46, grAllLines.length * 24 + 22);

      var ab = ev.abilities || {};
      var abDefs = [
        { title: 'إمكانيات والقدرات الحالية', val: ab.current_potentials || '—', bg: '#0F172A', fg: '#FFFFFF' },
        { title: 'المهارات المعرفية والفكرية', val: ab.cognitive_intellectual || '—', bg: '#F472B6', fg: '#0F172A' },
        { title: 'اللغة (استقبالية تعبيرية)', val: ab.language_receptive_expressive || '—', bg: '#60A5FA', fg: '#0F172A' },
        { title: 'القدرات الإتصالية والسلوكية', val: ab.communication_behavioral || '—', bg: '#FBBF24', fg: '#0F172A' },
        { title: 'المعارف الأكاديمية وما قبل الأكاديمي', val: ab.academic_preacademic || '—', bg: '#60A5FA', fg: '#0F172A' },
        { title: 'القدرات الحركية والاستقلالية', val: ab.motor_independence || '—', bg: '#60A5FA', fg: '#0F172A' }
      ];
      ctx.font = '14px "IBM Plex Sans Arabic", "Cairo", sans-serif';
      var totalAbH = 0;
      abDefs.forEach(function (item) {
        var ls = [];
        String(item.val || '—').replace(/\r\n/g, '\n').split('\n').forEach(function (p) {
          if (!p.trim()) return;
          ls = ls.concat(wrapLines(ctx, p.trim(), halfW - 22, 0));
        });
        if (!ls.length) ls = ['—'];
        item._lines = ls;
        item._bodyH = Math.max(28, ls.length * 20 + 12);
        item._totalH = 26 + item._bodyH + 4;
        totalAbH += item._totalH;
      });

      var gridH = Math.max(34 + grContentH, totalAbH - 4);
      if (y + gridH > H - 120) {
        var npGr = newPage('تقرير الأداء العام (تتمة)');
        ctx = npGr.ctx; y = npGr.y + 10;
      }

      // يمين: التقرير العام (ينتهي عند نهاية الكتابة)
      ctx.fillStyle = '#93C5FD';
      ctx.fillRect(rightColX, y, halfW, 34);
      ctx.strokeStyle = '#334155';
      ctx.strokeRect(rightColX, y, halfW, 34);
      ctx.fillStyle = '#0F172A';
      ctx.textAlign = 'center';
      ctx.font = 'bold 17px "IBM Plex Sans Arabic", "Cairo", sans-serif';
      ctx.fillText('التقرير العام والملاحظات البيداغوجية', rightColX + halfW / 2, y + 24);

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(rightColX, y + 34, halfW, grContentH);
      ctx.strokeRect(rightColX, y + 34, halfW, grContentH);

      ctx.fillStyle = '#0F172A';
      ctx.textAlign = 'right';
      ctx.font = '15.5px "IBM Plex Sans Arabic", "Cairo", sans-serif';
      grAllLines.forEach(function (ln, idx) {
        ctx.fillText(ln, rightColX + halfW - 14, y + 58 + idx * 24);
      });

      // يسار: 6 صناديق القدرات (كل صندوق ينتهي عند نهاية كتابته)
      var ay = y;
      abDefs.forEach(function (item) {
        ctx.fillStyle = item.bg;
        ctx.fillRect(leftColX, ay, halfW, 26);
        ctx.strokeStyle = '#334155';
        ctx.strokeRect(leftColX, ay, halfW, 26);
        ctx.fillStyle = item.fg;
        ctx.textAlign = 'right';
        ctx.font = 'bold 14.5px "IBM Plex Sans Arabic", "Cairo", sans-serif';
        ctx.fillText(item.title, leftColX + halfW - 10, ay + 19);

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(leftColX, ay + 26, halfW, item._bodyH);
        ctx.strokeRect(leftColX, ay + 26, halfW, item._bodyH);
        ctx.fillStyle = '#1E293B';
        ctx.font = '14px "IBM Plex Sans Arabic", "Cairo", sans-serif';
        item._lines.forEach(function (aln, aIdx) {
          ctx.fillText(aln, leftColX + halfW - 10, ay + 44 + aIdx * 20);
        });
        ay += item._totalH;
      });

      y += gridH + 14;

      // 6. البانر: الخلاصة والتوصيات + 3 أعمدة (تنتهي عند نهاية الكتابة تماماً)
      var recColW = CW / 3;
      ctx.font = '14px "IBM Plex Sans Arabic", "Cairo", sans-serif';
      var maxRecLines = 1;
      [ev.strengths, ev.weaknesses, ev.recommendations].forEach(function (arr) {
        var its = (arr || []).filter(function (x) { return x && String(x).trim(); });
        var cnt = 0;
        its.forEach(function (it) {
          cnt += wrapLines(ctx, '• ' + String(it).trim(), recColW - 22, 0).length;
        });
        if (cnt > maxRecLines) maxRecLines = cnt;
      });
      var recH = Math.max(76, 38 + maxRecLines * 22 + 16);
      if (y + 40 + recH > H - 100) {
        var npRec = newPage('الخلاصة والتوصيات');
        ctx = npRec.ctx; y = npRec.y + 10;
      }

      ctx.fillStyle = '#60A5FA';
      ctx.fillRect(M, y, CW, 34);
      ctx.strokeStyle = '#16A34A';
      ctx.strokeRect(M, y, CW, 34);
      ctx.fillStyle = '#0F172A';
      ctx.textAlign = 'center';
      ctx.font = 'bold 18px "IBM Plex Sans Arabic", "Cairo", sans-serif';
      ctx.fillText('الخلاصة والتوصيات', W / 2, y + 24);
      y += 40;
      var recCols = [
        { title: '1. نقاط القوة', arr: ev.strengths, fb: 'استجابة وتفاعل إيجابي مع الأنشطة الموجهة.', x: W - M - recColW },
        { title: '2. نقاط الضعف', arr: ev.weaknesses, fb: 'الحاجة لتعزيز مهارات التركيز والاستقلالية.', x: W - M - recColW * 2 },
        { title: '3. التوصيات والتوجيهات', arr: ev.recommendations, fb: 'مواصلة المتابعة البيداغوجية والتنسيق المستمر مع الأسرة.', x: M }
      ];
      recCols.forEach(function (rc) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(rc.x, y, recColW, recH);
        ctx.strokeStyle = '#334155';
        ctx.strokeRect(rc.x, y, recColW, recH);

        ctx.fillStyle = '#F8FAFC';
        ctx.fillRect(rc.x, y, recColW, 30);
        ctx.strokeRect(rc.x, y, recColW, 30);

        ctx.fillStyle = '#0F172A';
        ctx.textAlign = 'center';
        ctx.font = 'bold 15.5px "IBM Plex Sans Arabic", "Cairo", sans-serif';
        ctx.fillText(rc.title, rc.x + recColW / 2, y + 21);

        var items = (rc.arr || []).filter(function (x) { return x && String(x).trim(); });
        if (!items.length) items = [rc.fb];
        ctx.textAlign = 'right';
        ctx.font = '14px "IBM Plex Sans Arabic", "Cairo", sans-serif';
        ctx.fillStyle = '#1E293B';

        var maxRecLines = Math.floor((recH - 44) / 22);
        var allRecLines = [];
        items.forEach(function (itTxt) {
          var wrapped = wrapLines(ctx, '• ' + itTxt, recColW - 22, 3);
          allRecLines = allRecLines.concat(wrapped);
        });
        if (allRecLines.length > maxRecLines) {
          allRecLines = allRecLines.slice(0, maxRecLines);
          allRecLines[maxRecLines - 1] = allRecLines[maxRecLines - 1].replace(/[.\s…]+$/, '') + '…';
        }
        allRecLines.forEach(function (ln, lIdx) {
          ctx.fillText(ln, rc.x + recColW - 10, y + 52 + lIdx * 22);
        });
      });
      y += recH + 18;

      // تذييل التوقيعات والاعتماد الرسمي أسفل صفحة الملاحظات
      if (y < 1610) {
        var footY = Math.max(y, 1555);
        ctx.fillStyle = '#F8FAFC';
        ctx.fillRect(M, footY, CW, 85);
        ctx.strokeStyle = '#CBD5E1';
        ctx.strokeRect(M, footY, CW, 85);
        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 15px "IBM Plex Sans Arabic", "Cairo", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('إمضاء اللجنة البيداغوجية المشرفة', W - M - 260, footY + 32);
        ctx.fillText('ختم وتأشيرة إدارة المركز النفسي البيداغوجي دار الإحسان', M + 280, footY + 32);
        ctx.fillStyle = '#64748B';
        ctx.fillText('..................................................', W - M - 260, footY + 66);
        ctx.fillText('..................................................', M + 280, footY + 66);
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // القسم الثاني: التقرير التقييمي الكمي (الجدول + المشرفون + الأعمدة + الدائرة النسبية)
    // يُرسم عندما يكون reportType === 'statistics' أو 'full'
    // ══════════════════════════════════════════════════════════════════════════
    if (reportType === 'statistics' || reportType === 'full') {
      var qCanvas = document.createElement('canvas');
      qCanvas.width = W;
      qCanvas.height = 1754;
      var qCtx = qCanvas.getContext('2d');
      drawQuantitativeEvaluationPage(qCtx, W, statsObj, resolvedChildName, resolvedSection, kd, logoImg);
      pages.push({ canvas: qCanvas, ctx: qCtx, y: 1650 });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // القسم الثالث: الجداول التفصيلية لكافة المجالات والمهارات المقيمة (للإدارة في التقرير الشامل)
    // يُرسم عندما يكون reportType === 'full' أو 'details'
    // ══════════════════════════════════════════════════════════════════════════
    if (reportType === 'full' || reportType === 'details') {
      var pDet = newPage('الجداول التفصيلية لكافة المهارات المقيمة في المجالات التربوية');
      var dCtx = pDet.ctx;
      var dy = pDet.y;

      // شريط ملخص معيار الاكتساب
      dCtx.fillStyle = '#123E73';
      roundRect(dCtx, M, dy, CW, 40, 8);
      dCtx.fill();
      dCtx.fillStyle = '#FFFFFF';
      dCtx.textAlign = 'right';
      dCtx.font = 'bold 16px "IBM Plex Sans Arabic", "Cairo", sans-serif';
      dCtx.fillText('معيار دار الإحسان: تُحسب المهارة مكتسبة عند الدرجة 4/5 فما فوق', W - M - 18, dy + 26);

      dCtx.fillStyle = '#16A34A';
      roundRect(dCtx, M + 16, dy + 7, 320, 26, 13);
      dCtx.fill();
      dCtx.fillStyle = '#FFFFFF';
      dCtx.textAlign = 'center';
      dCtx.font = 'bold 14.5px "IBM Plex Sans Arabic", "Cairo", sans-serif';
      dCtx.fillText('المكتسبة: ' + statsObj.acquiredSkills + ' من ' + statsObj.totalSkills + ' مهارة (' + statsObj.overallPct + '%)', M + 176, dy + 25);
      dy += 52;

      var skW = [60, 628, 180, 260];
      var skX = [
        W - M - skW[0],
        W - M - skW[0] - skW[1],
        W - M - skW[0] - skW[1] - skW[2],
        M
      ];

      function drawSkillTableHeader(cCtx, curY) {
        var hdrs = ['#', 'المهارة المقيمة', 'الدرجة والاكتساب', 'الملاحظات والتوجيهات'];
        for (var i = 0; i < 4; i++) {
          cCtx.fillStyle = '#F1F5F9';
          cCtx.fillRect(skX[i], curY, skW[i], 30);
          cCtx.strokeStyle = '#334155';
          cCtx.lineWidth = 1;
          cCtx.strokeRect(skX[i], curY, skW[i], 30);
          cCtx.fillStyle = '#0F172A';
          cCtx.textAlign = 'center';
          cCtx.font = 'bold 14.5px "IBM Plex Sans Arabic", "Cairo", sans-serif';
          cCtx.fillText(hdrs[i], skX[i] + skW[i] / 2, curY + 20);
        }
        return curY + 30;
      }

      domainStats.forEach(function (dm, dIdx) {
        if (dy > 1560) {
          pDet = newPage('الجداول التفصيلية لكافة المهارات المقيمة (تابع)');
          dCtx = pDet.ctx;
          dy = pDet.y;
        }

        // ترويسة المجال التربوي مع شارة المهارات المكتسبة والنسبة
        dCtx.fillStyle = '#DBEAFE';
        dCtx.fillRect(M, dy, CW, 34);
        dCtx.strokeStyle = '#93C5FD';
        dCtx.strokeRect(M, dy, CW, 34);

        dCtx.fillStyle = '#1E3A8A';
        dCtx.textAlign = 'right';
        dCtx.font = 'bold 15.5px "IBM Plex Sans Arabic", "Cairo", sans-serif';
        dCtx.fillText((dIdx + 1) + '. ' + dm.name + ' (إجمالي المهارات: ' + dm.count + ')', W - M - 14, dy + 23);

        dCtx.fillStyle = '#DCFCE7';
        roundRect(dCtx, M + 14, dy + 5, 290, 24, 12);
        dCtx.fill();
        dCtx.strokeStyle = '#16A34A';
        dCtx.stroke();
        dCtx.fillStyle = '#15803D';
        dCtx.textAlign = 'center';
        dCtx.font = 'bold 13.5px "IBM Plex Sans Arabic", "Cairo", sans-serif';
        dCtx.fillText('المكتسبة: ' + dm.acquired + ' من ' + dm.count + ' (' + dm.pctFmt + '%)', M + 159, dy + 22);
        dy += 34;

        dy = drawSkillTableHeader(dCtx, dy);

        dm.ratings.forEach(function (rt, rIdx) {
          if (dy > 1640) {
            pDet = newPage('الجداول التفصيلية لكافة المهارات المقيمة (تابع)');
            dCtx = pDet.ctx;
            dy = pDet.y;
            dy = drawSkillTableHeader(dCtx, dy);
          }

          var rh = 28;
          var rowBg = (rIdx % 2 === 0) ? '#FFFFFF' : '#F8FAFC';
          for (var ci = 0; ci < 4; ci++) {
            dCtx.fillStyle = rowBg;
            dCtx.fillRect(skX[ci], dy, skW[ci], rh);
            dCtx.strokeStyle = '#CBD5E1';
            dCtx.lineWidth = 0.8;
            dCtx.strokeRect(skX[ci], dy, skW[ci], rh);
          }

          dCtx.fillStyle = '#0F172A';
          dCtx.textAlign = 'center';
          dCtx.font = 'bold 14px "IBM Plex Sans Arabic", "Cairo", sans-serif';
          dCtx.fillText(String(rt.num), skX[0] + skW[0] / 2, dy + 19);

          dCtx.textAlign = 'right';
          dCtx.font = 'bold 13.5px "IBM Plex Sans Arabic", "Cairo", sans-serif';
          dCtx.fillText(String(rt.skill).slice(0, 72), skX[1] + skW[1] - 10, dy + 19);

          // شارة الدرجة والاكتساب
          dCtx.fillStyle = rt.acquired ? '#D1FAE5' : '#F1F5F9';
          roundRect(dCtx, skX[2] + 18, dy + 4, skW[2] - 36, 20, 10);
          dCtx.fill();
          dCtx.fillStyle = rt.acquired ? '#163B65' : '#64748B';
          dCtx.textAlign = 'center';
          dCtx.font = 'bold 12.5px "IBM Plex Sans Arabic", "Cairo", sans-serif';
          dCtx.fillText(rt.badgeText + (rt.acquired ? ' • مكتسبة' : ''), skX[2] + skW[2] / 2, dy + 18);

          dCtx.fillStyle = '#475569';
          dCtx.font = '13px "IBM Plex Sans Arabic", "Cairo", sans-serif';
          dCtx.fillText(String(rt.note).slice(0, 34), skX[3] + skW[3] / 2, dy + 19);

          dy += rh;
        });

        dy += 14;
      });
    }

    // ترقيم الصفحات في أسفل كل صفحة
    var totalPages = pages.length;
    pages.forEach(function (pg, idx) {
      var cCtx = pg.ctx;
      cCtx.fillStyle = '#64748B';
      cCtx.textAlign = 'center';
      cCtx.font = '13px "IBM Plex Sans Arabic", "Cairo", sans-serif';
      cCtx.fillText('الصفحة ' + (idx + 1) + ' من ' + totalPages + ' — المركز النفسي البيداغوجي دار الإحسان (العطف - غرداية)', W / 2, 1685);
      cCtx.font = '12px "IBM Plex Sans Arabic", "Cairo", sans-serif';
      cCtx.fillText('نسخة التقرير: ' + reportTemplateVersion + ' | تاريخ ووقت الإنشاء: ' + generatedAtText, W / 2, 1708);
    });

    var jpegPages = [];
    for (var k = 0; k < pages.length; k++) {
      var jpgBytes = await canvasToJpegBytes(pages[k].canvas, 0.94);
      jpegPages.push({ data: jpgBytes, width: W, height: 1754 });
    }
    return buildPdfBinary(jpegPages);
  }

  async function renderAttendanceToPdf(records, dateStr, secName, stats) {
    var logoImg = await loadLogoImage();
    var W = 1240, H = 1754, M = 56, CW = W - M * 2;
    var rows = Array.isArray(records) ? records : [];
    var rowsPerPage = 20;
    var totalPages = Math.max(1, Math.ceil(rows.length / rowsPerPage));
    var pages = [];

    for (var p = 0; p < totalPages; p++) {
      var c = document.createElement('canvas');
      c.width = W; c.height = H;
      var ctx = c.getContext('2d');
      drawOfficialHeader(ctx, W, 'سجل الغيابات والحضور اليومي — دار الإحسان', logoImg);

      ctx.fillStyle = '#F4F7FB';
      ctx.fillRect(M, 205, CW, 70);
      ctx.strokeStyle = '#102F50';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(M, 205, CW, 70);

      ctx.fillStyle = '#102F50';
      ctx.font = 'bold 18px "IBM Plex Sans Arabic", "Cairo", sans-serif';
      ctx.textAlign = 'right';
      ctx.direction = 'rtl';
      ctx.fillText('التاريخ: ' + (dateStr || new Date().toISOString().slice(0, 10)), W - M - 20, 245);
      ctx.fillText('القسم / الفوج: ' + (secName || 'كافة الأقسام المعتمدة'), W - M - 320, 245);

      if (stats) {
        ctx.font = '16px "IBM Plex Sans Arabic", "Cairo", sans-serif';
        ctx.fillStyle = '#2563EB';
        ctx.fillText('الحاضرون: ' + (stats.present || 0), W - M - 680, 245);
        ctx.fillStyle = '#DC2626';
        ctx.fillText('الغائبون: ' + (stats.absent || 0), W - M - 840, 245);
        ctx.fillStyle = '#174D78';
        ctx.fillText('الإجمالي: ' + (rows.length || 0), W - M - 980, 245);
      }

      var y = 295;
      var colW = [60, 140, 360, 220, 160, CW - (60 + 140 + 360 + 220 + 160)];
      var colX = [];
      var curX = M;
      for (var ci = 0; ci < colW.length; ci++) { colX.push(curX); curX += colW[ci]; }
      var headers = ['#', 'رقم القيد', 'اسم ولقب التلميذ(ة)', 'الفوج / القسم', 'الحالة', 'ملاحظات وتوجيهات'];

      ctx.fillStyle = '#102F50';
      ctx.fillRect(M, y, CW, 38);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 16px "IBM Plex Sans Arabic", "Cairo", sans-serif';
      ctx.textAlign = 'center';
      for (var hi = 0; hi < headers.length; hi++) {
        ctx.fillText(headers[hi], colX[hi] + colW[hi] / 2, y + 25);
      }
      y += 38;

      var startIdx = p * rowsPerPage;
      var endIdx = Math.min(rows.length, startIdx + rowsPerPage);
      for (var i = startIdx; i < endIdx; i++) {
        var r = rows[i];
        var isEven = (i % 2 === 0);
        ctx.fillStyle = isEven ? '#FFFFFF' : '#F8FAFC';
        ctx.fillRect(M, y, CW, 36);
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 1;
        ctx.strokeRect(M, y, CW, 36);

        ctx.fillStyle = '#26364A';
        ctx.font = '15px "IBM Plex Sans Arabic", "Cairo", sans-serif';
        ctx.fillText(String(i + 1), colX[0] + colW[0] / 2, y + 23);
        ctx.fillText(r.membership_no ? ('N° ' + r.membership_no) : '—', colX[1] + colW[1] / 2, y + 23);

        ctx.textAlign = 'right';
        ctx.font = 'bold 15px "IBM Plex Sans Arabic", "Cairo", sans-serif';
        ctx.fillText(r.full_name || '—', colX[2] + colW[2] - 14, y + 23);

        ctx.textAlign = 'center';
        ctx.font = '14px "IBM Plex Sans Arabic", "Cairo", sans-serif';
        ctx.fillText(r.section || secName || '—', colX[3] + colW[3] / 2, y + 23);

        var st = r.status || 'present';
        var isP = (st === 'present' || st === 'حاضر');
        var isA = (st === 'absent' || st === 'غائب');
        ctx.fillStyle = isP ? '#EAF4FF' : (isA ? '#FEF2F2' : '#F1F5F9');
        drawRoundedRect(ctx, colX[4] + 20, y + 5, colW[4] - 40, 26, 6);
        ctx.fill();
        ctx.fillStyle = isP ? '#2563EB' : (isA ? '#DC2626' : '#64748B');
        ctx.font = 'bold 14px "IBM Plex Sans Arabic", "Cairo", sans-serif';
        ctx.fillText(isP ? 'حاضر' : (isA ? 'غائب' : 'لم يُسجّل'), colX[4] + colW[4] / 2, y + 22);

        ctx.fillStyle = '#64748B';
        ctx.font = '13px "IBM Plex Sans Arabic", "Cairo", sans-serif';
        ctx.fillText(r.note || '—', colX[5] + colW[5] / 2, y + 23);

        y += 36;
      }

      if (p === totalPages - 1) {
        var signY = 1530;
        ctx.fillStyle = '#F4F7FB';
        ctx.fillRect(M, signY, CW, 120);
        ctx.strokeStyle = '#CBD5E1';
        ctx.strokeRect(M, signY, CW, 120);

        ctx.fillStyle = '#102F50';
        ctx.font = 'bold 16px "IBM Plex Sans Arabic", "Cairo", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('توقيع المربي(ة) المشرف(ة)', M + 240, signY + 35);
        ctx.fillText('ختم وتأشيرة إدارة المركز', W - M - 240, signY + 35);

        ctx.font = '14px "IBM Plex Sans Arabic", "Cairo", sans-serif';
        ctx.fillStyle = '#64748B';
        ctx.fillText('....................................', M + 240, signY + 80);
        ctx.fillText('....................................', W - M - 240, signY + 80);
      }

      ctx.fillStyle = '#64748B';
      ctx.textAlign = 'center';
      ctx.font = '14px "IBM Plex Sans Arabic", "Cairo", sans-serif';
      ctx.fillText('الصفحة ' + (p + 1) + ' من ' + totalPages + ' — جمعية دار الإحسان لرعاية وتأهيل ذوي الاحتياجات الخاصة (العطف - غرداية)', W / 2, 1702);

      pages.push({ canvas: c, ctx: ctx });
    }

    var jpegPages = [];
    for (var k = 0; k < pages.length; k++) {
      var jpgBytes = await canvasToJpegBytes(pages[k].canvas, 0.94);
      jpegPages.push({ data: jpgBytes, width: W, height: H });
    }
    return buildPdfBinary(jpegPages);
  }

  async function renderChildrenListToPdf(kids, secName, branchName) {
    var logoImg = await loadLogoImage();
    var W = 1240, H = 1754, M = 56, CW = W - M * 2;
    var rows = Array.isArray(kids) ? kids : [];
    var rowsPerPage = 22;
    var totalPages = Math.max(1, Math.ceil(rows.length / rowsPerPage));
    var pages = [];

    for (var p = 0; p < totalPages; p++) {
      var c = document.createElement('canvas');
      c.width = W; c.height = H;
      var ctx = c.getContext('2d');
      drawOfficialHeader(ctx, W, 'القائمة الرسمية للطلبة والأطفال — دار الإحسان', logoImg);

      ctx.fillStyle = '#F4F7FB';
      ctx.fillRect(M, 205, CW, 65);
      ctx.strokeStyle = '#102F50';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(M, 205, CW, 65);

      ctx.fillStyle = '#102F50';
      ctx.font = 'bold 18px "IBM Plex Sans Arabic", "Cairo", sans-serif';
      ctx.textAlign = 'right';
      ctx.direction = 'rtl';
      ctx.fillText('المركز / الفرع: ' + (branchName || 'دار الإحسان - المركز الرئيسي'), W - M - 20, 245);
      ctx.fillText('القسم: ' + (secName || 'كافة الأقسام التربوية'), W - M - 480, 245);
      ctx.fillText('العدد الإجمالي: ' + rows.length + ' تلميذ', W - M - 880, 245);

      var y = 290;
      var colW = [50, 110, 310, 140, 180, 150, 188];
      var colX = [];
      var curX = M;
      for (var ci = 0; ci < colW.length; ci++) { colX.push(curX); curX += colW[ci]; }
      var headers = ['#', 'رقم القيد', 'اسم ولقب التلميذ(ة)', 'تاريخ الميلاد', 'طبيعة الإعاقة', 'القسم', 'رقم هاتف الولي'];

      ctx.fillStyle = '#102F50';
      ctx.fillRect(M, y, CW, 38);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 16px "IBM Plex Sans Arabic", "Cairo", sans-serif';
      ctx.textAlign = 'center';
      for (var hi = 0; hi < headers.length; hi++) {
        ctx.fillText(headers[hi], colX[hi] + colW[hi] / 2, y + 25);
      }
      y += 38;

      var startIdx = p * rowsPerPage;
      var endIdx = Math.min(rows.length, startIdx + rowsPerPage);
      for (var i = startIdx; i < endIdx; i++) {
        var k = rows[i];
        var isEven = (i % 2 === 0);
        ctx.fillStyle = isEven ? '#FFFFFF' : '#F8FAFC';
        ctx.fillRect(M, y, CW, 34);
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 1;
        ctx.strokeRect(M, y, CW, 34);

        ctx.fillStyle = '#26364A';
        ctx.font = '14px "IBM Plex Sans Arabic", "Cairo", sans-serif';
        ctx.fillText(String(i + 1), colX[0] + colW[0] / 2, y + 22);
        ctx.fillText(k.membership_no ? ('N° ' + k.membership_no) : '—', colX[1] + colW[1] / 2, y + 22);

        ctx.textAlign = 'right';
        ctx.font = 'bold 14px "IBM Plex Sans Arabic", "Cairo", sans-serif';
        ctx.fillText(k.full_name || '—', colX[2] + colW[2] - 12, y + 22);

        ctx.textAlign = 'center';
        ctx.font = '13.5px "IBM Plex Sans Arabic", "Cairo", sans-serif';
        ctx.fillText(k.dob || '—', colX[3] + colW[3] / 2, y + 22);
        ctx.fillText(k.disability || '—', colX[4] + colW[4] / 2, y + 22);
        ctx.fillText(k.section || secName || '—', colX[5] + colW[5] / 2, y + 22);

        ctx.font = '13.5px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(k.phone || '—', colX[6] + colW[6] / 2, y + 22);

        y += 34;
      }

      ctx.fillStyle = '#64748B';
      ctx.textAlign = 'center';
      ctx.font = '14px "IBM Plex Sans Arabic", "Cairo", sans-serif';
      ctx.fillText('الصفحة ' + (p + 1) + ' من ' + totalPages + ' — المركز النفسي البيداغوجي دار الإحسان (العطف - غرداية)', W / 2, 1702);

      pages.push({ canvas: c, ctx: ctx });
    }

    var jpegPages = [];
    for (var k = 0; k < pages.length; k++) {
      var jpgBytes = await canvasToJpegBytes(pages[k].canvas, 0.94);
      jpegPages.push({ data: jpgBytes, width: W, height: H });
    }
    return buildPdfBinary(jpegPages);
  }


      /* =====================================================================
     توليد وثيقة البرنامج المؤقت الأسبوعي بصيغة A4 أفقي (Landscape 1754x1240)
     مطابقة تماماً للنموذج الورقي الرسمي المعتمد لدار الإحسان (23499.jpg)
     مع جدول الأنصبة الأسبوعية والدمج الأفقي والرأسي بين الأيام
     ===================================================================== */
  var DOMAIN_PALETTE = [
    { bg: '#EAF4FF', border: '#2563EB', badgeBg: '#2563EB', text: '#163B65' },
    { bg: '#EFF6FF', border: '#3B82F6', badgeBg: '#2563EB', text: '#1E3A8A' },
    { bg: '#FEF3C7', border: '#F59E0B', badgeBg: '#D97706', text: '#78350F' },
    { bg: '#F3E8FF', border: '#A855F7', badgeBg: '#7C3AED', text: '#4C1D95' },
    { bg: '#FFE4E6', border: '#F43F5E', badgeBg: '#E11D48', text: '#881337' },
    { bg: '#E0F2FE', border: '#0EA5E9', badgeBg: '#0284C7', text: '#0C4A6E' },
    { bg: '#F1F5F9', border: '#64748B', badgeBg: '#475569', text: '#0F172A' },
    { bg: '#FCE7F3', border: '#EC4899', badgeBg: '#DB2777', text: '#831843' }
  ];

  function hashDomainIdx(domName) {
    var s = String(domName || '');
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 997;
    return h % DOMAIN_PALETTE.length;
  }

  function drawWeeklyProgramLandscapePage(ctx, W, H, progState, secName, logoImg) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);

    var M = 28;
    ctx.strokeStyle = '#163B65';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(M, M, W - M * 2, H - M * 2);

    // 1. رأس الصفحة (Header) المطابق تماماً لـ 23499.jpg
    var hdrX = M + 10;
    var hdrY = M + 10;
    var hdrW = W - (M + 10) * 2;
    var hdrH = 110;

    // الشعار على اليمين كما في الصورة
    if (logoImg && logoImg.width) {
      ctx.drawImage(logoImg, 48, hdrY + 4, 94, 94);
    }
    // العلم الجزائري على اليسار
    drawAlgeriaFlagCircle(ctx, hdrX + 54, hdrY + 54, 38);

    // النصوص في الوسط وأعلى الصفحة
    ctx.direction = 'rtl';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#163B65';
    ctx.font = 'bold 18px "Cairo", "Tajawal", "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText('جمعية أولياء الأطفال المعاقين ذهنيًا', W / 2, hdrY + 24);
    ctx.font = 'bold 16.5px "Cairo", "Tajawal", "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText('المركز النفسي البيداغوجي دار الإحسان', W / 2, hdrY + 48);
    ctx.fillStyle = '#475569';
    ctx.font = 'bold 14px "Cairo", "Tajawal", "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText('- العطف - غرداية -', W / 2, hdrY + 68);

    // العنوان الرئيسي في الوسط: «البرنامج المؤقت الأسبوعي 02»
    ctx.fillStyle = '#1D4ED8';
    ctx.font = 'bold 24px "Cairo", "Tajawal", "IBM Plex Sans Arabic", sans-serif';
    var groupNum = secName ? secName.replace(/[^\d]/g, '') : '02';
    var mainTitle = 'البرنامج المؤقت الأسبوعي ' + (groupNum ? groupNum : (secName || '02'));
    ctx.fillText(mainTitle, W / 2, hdrY + 98);

    // الموسم الدراسي والفوج على اليسار
    ctx.textAlign = 'left';
    ctx.fillStyle = '#163B65';
    ctx.font = 'bold 15px "Cairo", "Tajawal", "IBM Plex Sans Arabic", sans-serif';
    var acYear = (progState && progState.academic_year) || '2026/2027';
    ctx.fillText('الموسم الدراسي: ' + acYear, hdrX + 106, hdrY + 36);
    ctx.font = 'bold 15px "Cairo", "Tajawal", "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText('الفوج: ' + (secName || 'توحد 02'), hdrX + 106, hdrY + 64);

    // 2. جدول ملخص الأنشطة والأنصبة الأسبوعية في أعلى الصفحة (مطابق لـ 23499.jpg)
    var loadTblY = hdrY + hdrH + 6;
    var loadTblH = 80;
    var loadSummary = [
      { code: 'ATM*', name: 'الأنشطة التعليمية', count: '01', duration: '15min', color: '#F3E8FF' },
      { code: 'MT*', name: 'الحركية الدقيقة', count: '05', duration: '30-45min', color: '#DBEAFE' },
      { code: 'P*A', name: 'الاستقلالية', count: '08', duration: '45min', color: '#BFDBFE' },
      { code: 'Intg', name: 'التكامل الحسي', count: '01', duration: '45min', color: '#CFFAFE' },
      { code: 'L99 (E)', name: 'اللغة والتواصل', count: '02', duration: '45min', color: '#E0E7FF' },
      { code: 'Pst G', name: 'المعرفي الأكاديمي', count: '01', duration: '45min', color: '#D1FAE5' },
      { code: 'Act stim', name: 'الاستثارة والأنشطة', count: '03', duration: '30-45min', color: '#FEF08A' },
      { code: 'RELX', name: 'الاستراحة والاسترخاء', count: '01', duration: '30min', color: '#FBCFE8' },
      { code: 'ACQS', name: 'المهارات المكتسبة', count: '01', duration: '30min', color: '#F5D0FE' },
      { code: 'PERCP', name: 'الإدراك والتفاعل', count: '02', duration: '30-45min', color: '#E9D5FF' },
      { code: 'المجموع', name: 'الحجم الإجمالي', count: '25', duration: '25H', color: '#F1F5F9' }
    ];

    var loadColCount = loadSummary.length;
    var loadHeadW = 120;
    var loadColsW = (hdrW - loadHeadW) / loadColCount;

    // رسم صفوف جدول الأنصبة
    var rowH1 = 28, rowH2 = 26, rowH3 = 26;

    // الصف 1: الأنشطة التعليمية
    ctx.fillStyle = '#163B65';
    ctx.fillRect(W - hdrX - loadHeadW, loadTblY, loadHeadW, rowH1);
    ctx.strokeStyle = '#CBD5E1';
    ctx.strokeRect(W - hdrX - loadHeadW, loadTblY, loadHeadW, rowH1);
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.font = 'bold 13px "Cairo", "Tajawal", sans-serif';
    ctx.fillText('الأنشطة التعليمية', W - hdrX - loadHeadW / 2, loadTblY + 19);

    loadSummary.forEach(function (it, idx) {
      var lx = W - hdrX - loadHeadW - (idx + 1) * loadColsW;
      ctx.fillStyle = it.color;
      ctx.fillRect(lx, loadTblY, loadColsW, rowH1);
      ctx.strokeRect(lx, loadTblY, loadColsW, rowH1);
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 12.5px "Cairo", "Tajawal", sans-serif';
      ctx.fillText(it.code, lx + loadColsW / 2, loadTblY + 19);
    });

    // الصف 2: الحجم الساعي
    ctx.fillStyle = '#F8FAF9';
    ctx.fillRect(W - hdrX - loadHeadW, loadTblY + rowH1, loadHeadW, rowH2);
    ctx.strokeRect(W - hdrX - loadHeadW, loadTblY + rowH1, loadHeadW, rowH2);
    ctx.fillStyle = '#1E293B';
    ctx.font = 'bold 12.5px "Cairo", "Tajawal", sans-serif';
    ctx.fillText('الحجم الساعي', W - hdrX - loadHeadW / 2, loadTblY + rowH1 + 18);

    loadSummary.forEach(function (it, idx) {
      var lx = W - hdrX - loadHeadW - (idx + 1) * loadColsW;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(lx, loadTblY + rowH1, loadColsW, rowH2);
      ctx.strokeRect(lx, loadTblY + rowH1, loadColsW, rowH2);
      ctx.fillStyle = '#334155';
      ctx.font = '11.5px "Cairo", "Tajawal", "Plus Jakarta Sans", sans-serif';
      ctx.fillText(it.duration, lx + loadColsW / 2, loadTblY + rowH1 + 18);
    });

    // الصف 3: عدد الحصص
    ctx.fillStyle = '#F8FAF9';
    ctx.fillRect(W - hdrX - loadHeadW, loadTblY + rowH1 + rowH2, loadHeadW, rowH3);
    ctx.strokeRect(W - hdrX - loadHeadW, loadTblY + rowH1 + rowH2, loadHeadW, rowH3);
    ctx.fillStyle = '#1E293B';
    ctx.font = 'bold 12.5px "Cairo", "Tajawal", sans-serif';
    ctx.fillText('عدد الحصص', W - hdrX - loadHeadW / 2, loadTblY + rowH1 + rowH2 + 18);

    loadSummary.forEach(function (it, idx) {
      var lx = W - hdrX - loadHeadW - (idx + 1) * loadColsW;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(lx, loadTblY + rowH1 + rowH2, loadColsW, rowH3);
      ctx.strokeRect(lx, loadTblY + rowH1 + rowH2, loadColsW, rowH3);
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 13px "Cairo", "Tajawal", "Plus Jakarta Sans", sans-serif';
      ctx.fillText(it.count, lx + loadColsW / 2, loadTblY + rowH1 + rowH2 + 18);
    });

    // 3. جدول الحصص الأسبوعي الرئيسي (مطابق تماماً لـ 23499.jpg)
    var tblX = hdrX;
    var tblY = loadTblY + loadTblH + 10;
    var tblW = hdrW;
    var footerH = 88;
    var tblH = (H - M - footerH - 10) - tblY;

    var daysList = (progState && Array.isArray(progState.days) && progState.days.length) ? progState.days : [
      { day: 'sun', label: 'الأحد', sessions: [] },
      { day: 'mon', label: 'الإثنين', sessions: [] },
      { day: 'tue', label: 'الثلاثاء', sessions: [] },
      { day: 'wed', label: 'الأربعاء', sessions: [] },
      { day: 'thu', label: 'الخميس', sessions: [] }
    ];

    var timeSlots = (progState && Array.isArray(progState.time_slots) && progState.time_slots.length)
      ? progState.time_slots
      : [
          { id: 0, start: '08:00', end: '09:00', period: 'morning' },
          { id: 1, start: '09:00', end: '09:45', period: 'morning' },
          { id: 2, start: '09:45', end: '10:30', period: 'morning' },
          { id: 3, start: '10:30', end: '11:00', period: 'morning' },
          { id: 4, start: '11:00', end: '12:00', period: 'morning' },
          { id: 5, start: '12:00', end: '12:45', period: 'afternoon' },
          { id: 6, start: '12:45', end: '13:40', period: 'afternoon' },
          { id: 7, start: '13:40', end: '14:00', period: 'afternoon' }
        ];

    var morningSlots = timeSlots.filter(function (s) { return s.period === 'morning'; });
    var afternoonSlots = timeSlots.filter(function (s) { return s.period === 'afternoon'; });
    if (!morningSlots.length) morningSlots = timeSlots.slice(0, 6);
    if (!afternoonSlots.length) afternoonSlots = timeSlots.slice(6);

    var dayColW = 100;
    var slotsAreaW = tblW - dayColW;
    var totalSlotsCount = timeSlots.length;
    var baseSlotW = slotsAreaW / totalSlotsCount;

    var periodBarH = 32;
    var timeBarH = 34;
    var tableHeaderH = periodBarH + timeBarH;

    // خلية "اليوم"
    ctx.fillStyle = '#163B65';
    ctx.fillRect(W - tblX - dayColW, tblY, dayColW, tableHeaderH);
    ctx.strokeStyle = '#163B65';
    ctx.lineWidth = 1.4;
    ctx.strokeRect(W - tblX - dayColW, tblY, dayColW, tableHeaderH);

    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.font = 'bold 15px "Cairo", "Tajawal", sans-serif';
    ctx.fillText('اليوم', W - tblX - dayColW / 2, tblY + tableHeaderH / 2 + 5);

    // شريط الفترة الصباحية
    var morningW = morningSlots.length * baseSlotW;
    var morningX = W - tblX - dayColW - morningW;
    ctx.fillStyle = '#EAF4FF';
    ctx.fillRect(morningX, tblY, morningW, periodBarH);
    ctx.strokeStyle = '#2563EB';
    ctx.strokeRect(morningX, tblY, morningW, periodBarH);

    ctx.fillStyle = '#163B65';
    ctx.font = 'bold 14px "Cairo", "Tajawal", sans-serif';
    ctx.fillText('الفترة الصباحية  08:00 — 12:00', morningX + morningW / 2, tblY + 20);

    // شريط الفترة المسائية
    var afternoonW = afternoonSlots.length * baseSlotW;
    var afternoonX = tblX;
    ctx.fillStyle = '#FEF3C7';
    ctx.fillRect(afternoonX, tblY, afternoonW, periodBarH);
    ctx.strokeStyle = '#F59E0B';
    ctx.strokeRect(afternoonX, tblY, afternoonW, periodBarH);

    ctx.fillStyle = '#92400E';
    ctx.font = 'bold 14px "Cairo", "Tajawal", sans-serif';
    ctx.fillText('الفترة المسائية  12:00 — 14:00', afternoonX + afternoonW / 2, tblY + 20);

    // شريط التوقيتات الدقيقة لكل خانة
    timeSlots.forEach(function (slot, sIdx) {
      var sx = W - tblX - dayColW - (sIdx + 1) * baseSlotW;
      ctx.fillStyle = '#F8FAF9';
      ctx.fillRect(sx, tblY + periodBarH, baseSlotW, timeBarH);
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 1;
      ctx.strokeRect(sx, tblY + periodBarH, baseSlotW, timeBarH);

      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 14px "Plus Jakarta Sans", "Cairo", sans-serif';
      ctx.fillText(slot.start + ' - ' + slot.end, sx + baseSlotW / 2, tblY + periodBarH + 22);
    });

    // رسم صفوف الأيام الـ 5 مع الدمج الأفقي والرأسي بين الأيام
    var gridTopY = tblY + tableHeaderH;
    var gridAvailH = tblH - tableHeaderH;
    var numDays = daysList.length;
    var dayRowH = Math.floor(gridAvailH / numDays);

    var coveredByRowspan = {};

    daysList.forEach(function (dyObj, dayIdx) {
      var ry = gridTopY + dayIdx * dayRowH;
      var dayRightX = W - tblX - dayColW;

      ctx.fillStyle = (dayIdx % 2 === 0) ? '#163B65' : '#163B65';
      ctx.fillRect(dayRightX, ry, dayColW, dayRowH);
      ctx.strokeStyle = '#163B65';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(dayRightX, ry, dayColW, dayRowH);

      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.font = 'bold 17px "Cairo", "Tajawal", sans-serif';
      ctx.fillText(dyObj.label || '', dayRightX + dayColW / 2, ry + dayRowH / 2 + 6);

      var sessions = dyObj.sessions || [];
      sessions.forEach(function (sess) {
        var covKey = dayIdx + ':' + sess.slot_id;
        if (coveredByRowspan[covKey]) return;

        var colspan = sess.colspan || 1;
        var rowspan = sess.rowspan || 1;

        if (rowspan > 1) {
          for (var r = 1; r < rowspan; r++) {
            for (var c = 0; c < colspan; c++) {
              coveredByRowspan[(dayIdx + r) + ':' + (sess.slot_id + c)] = true;
            }
          }
        }

        var cellW = colspan * baseSlotW;
        var cellH = rowspan * dayRowH;
        var sx = dayRightX - (sess.slot_id + colspan) * baseSlotW;

        var isAct = (sess.kind === 'activity' || sess.kind === 'break');
        var isLib = (sess.kind === 'library' || (!isAct && sess.domain && sess.skill));
        var isMan = (sess.kind === 'manual' || (!isAct && !isLib && (sess.manual_text || sess.title)));
        var isFilled = (isAct || isLib || isMan);

        // رسم جميع الخانات بيضاء ناصعة (#FFFFFF) بإطار أسود محكم (#1E293B) وكتابة سوداء مكبرة وعريضة (#000000)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(sx, ry, cellW, cellH);
        ctx.strokeStyle = '#1E293B';
        ctx.lineWidth = 1.3;
        ctx.strokeRect(sx, ry, cellW, cellH);

        if (isAct) {
          ctx.fillStyle = '#000000';
          ctx.font = (rowspan > 1 ? '900 28px ' : '900 24px ') + '"Cairo", "Tajawal", "IBM Plex Sans Arabic", sans-serif';
          var actText = sess.activity || sess.title || 'نشاط يومي';
          var actLines = wrapLines(ctx, actText, cellW - 14, 3);
          var lineH = rowspan > 1 ? 30 : 25;
          var startActY = ry + (cellH - (actLines.length * lineH)) / 2 + lineH - 4;
          actLines.forEach(function (aln, lIdx) {
            ctx.fillText(aln, sx + cellW / 2, startActY + lIdx * lineH);
          });
        } else if (isLib) {
          // اسم المجال بخط واضح وداكن في الأعلى
          var shortDom = String(sess.domain || 'مجال بيداغوجي').replace(/\s*\(.*?\)\s*/g, '').trim();
          ctx.fillStyle = '#334155';
          ctx.font = 'bold 16px "Cairo", "Tajawal", "IBM Plex Sans Arabic", sans-serif';
          var domWrap = wrapLines(ctx, '(' + shortDom + ')', cellW - 12, 1);
          ctx.fillText(domWrap[0] || ('(' + shortDom + ')'), sx + cellW / 2, ry + 25);

          // اسم المهارة بخط أسود عريض جداً ومكبر وواضح
          ctx.fillStyle = '#000000';
          ctx.font = (rowspan > 1 ? '900 25px ' : '900 22px ') + '"Cairo", "Tajawal", "IBM Plex Sans Arabic", sans-serif';
          var skText = sess.skill || sess.title || '';
          var skLines = wrapLines(ctx, skText, cellW - 14, 3);
          var skLineH = 23;
          var availH = cellH - 44;
          var startSkY = (ry + 44) + (availH - (skLines.length * skLineH)) / 2 + skLineH - 4;
          skLines.forEach(function (sln, lIdx) {
            ctx.fillText(sln, sx + cellW / 2, startSkY + lIdx * skLineH);
          });
        } else if (isMan) {
          ctx.fillStyle = '#000000';
          ctx.font = (rowspan > 1 ? '900 26px ' : '900 22px ') + '"Cairo", "Tajawal", "IBM Plex Sans Arabic", sans-serif';
          var manText = sess.manual_text || sess.title || '';
          var manLines = wrapLines(ctx, manText, cellW - 14, 3);
          var mLineH = 24;
          var startManY = ry + (cellH - (manLines.length * mLineH)) / 2 + mLineH - 4;
          manLines.forEach(function (mln, lIdx) {
            ctx.fillText(mln, sx + cellW / 2, startManY + lIdx * mLineH);
          });
        }
      });
    });

    // 4. تذييل توقيع وختم مدير المركز فقط
    var footY = H - M - footerH;
    ctx.fillStyle = '#F8FAF9';
    roundRect(ctx, tblX, footY, tblW, footerH, 8);
    ctx.fill();
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1;
    ctx.stroke();

    var dirBoxW = Math.floor(tblW * 0.40);
    var dirBoxX = W / 2 - dirBoxW / 2;
    var footBoxH = footerH - 10;
    var footBoxY = footY + 5;

    ctx.fillStyle = '#FFFFFF';
    roundRect(ctx, dirBoxX, footBoxY, dirBoxW, footBoxH, 6);
    ctx.fill();
    ctx.strokeStyle = '#163B65';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#163B65';
    ctx.textAlign = 'center';
    ctx.font = 'bold 16px "Cairo", "Tajawal", sans-serif';
    ctx.fillText('توقيع وختم مدير المركز', dirBoxX + dirBoxW / 2, footBoxY + 28);
    ctx.fillStyle = '#64748B';
    ctx.font = '12px "Cairo", "Tajawal", sans-serif';
    ctx.fillText('التأشيرة والختم الرسمي لدار الإحسان', dirBoxX + dirBoxW / 2, footBoxY + footBoxH - 12);
  }

  async function renderWeeklyProgramCanvas(progState, secName) {
    if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch (e) {}
    }
    var logoImg = await loadLogoImage();
    var c = document.createElement('canvas');
    c.width = 1754;
    c.height = 1240;
    var ctx = c.getContext('2d');
    drawWeeklyProgramLandscapePage(ctx, 1754, 1240, progState, secName, logoImg);
    return c;
  }

  async function renderWeeklyProgramToPdf(progState, secName) {
    var c = await renderWeeklyProgramCanvas(progState, secName);
    var jpgBytes = await canvasToJpegBytes(c, 0.95);
    return buildPdfBinary([{ data: jpgBytes, width: 1754, height: 1240 }]);
  }

  
  async function renderBehaviorObservationToPdf(ev, childFullName, secName, kd) {
    if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch (e) {}
    }
    var logoImg = await loadLogoImage();
    var c = document.createElement('canvas');
    var W = 1240, H = 1754;
    c.width = W; c.height = H;
    var ctx = c.getContext('2d');

    // خلفية بيضاء وإطار خارجي
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#163B65';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(36, 36, W - 72, H - 72);

    // الشعار في أعلى اليسار
    if (logoImg && logoImg.width) {
      ctx.drawImage(logoImg, 55, 52, 110, 110);
    }

    // الترويسة يميناً
    ctx.textAlign = 'right';
    ctx.direction = 'rtl';
    ctx.fillStyle = '#163B65';
    ctx.font = 'bold 20px "IBM Plex Sans Arabic", "Cairo", sans-serif';
    ctx.fillText('جمعية أولياء الأطفال المعاقين ذهنياً', W - 60, 75);
    ctx.font = 'bold 18px "IBM Plex Sans Arabic", "Cairo", sans-serif';
    ctx.fillStyle = '#2563EB';
    ctx.fillText('المركز النفسي البيداغوجي دار الإحسان', W - 60, 105);
    ctx.font = '14px "Cairo", sans-serif';
    ctx.fillStyle = '#64748B';
    ctx.fillText('— العطف - غرداية —', W - 60, 132);

    // عنوان الاستمارة في الوسط
    ctx.textAlign = 'center';
    ctx.fillStyle = '#163B65';
    ctx.font = '900 28px "IBM Plex Sans Arabic", "Cairo", sans-serif';
    ctx.fillText('استمارة ملاحظة سلوك', W / 2, 185);

    var obs = ev.behavior_observation || {};
    var itemsState = obs.items || {};

    // شريط معلومات الحالة
    var infoY = 220;
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(50, infoY, W - 100, 50);
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1;
    ctx.strokeRect(50, infoY, W - 100, 50);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#163B65';
    ctx.font = 'bold 15px "Cairo", sans-serif';
    ctx.fillText('اسم و لقب الحالة: ' + (childFullName || '—'), W - 70, infoY + 31);
    ctx.fillText('الإعاقة/الاضطراب: ' + (obs.disability || (kd && kd.disability) || '—'), W - 500, infoY + 31);
    var ageVal = obs.age || (kd && kd.dob ? (function(dob){
      try {
        var bd = new Date(dob); var td = new Date(); var a = td.getFullYear() - bd.getFullYear();
        return a > 0 ? (a + ' سنة') : '—';
      } catch(e){return '—';}
    })(kd.dob) : '—');
    ctx.fillText('العمر: ' + ageVal, W - 920, infoY + 31);

    // جدول الـ 16 مؤشر
    var tblY = 285;
    var colW = { expr: 540, yes: 95, med: 95, no: 95, notes: 315 };
    var totalW = W - 100;

    // رأس الجدول
    ctx.fillStyle = '#163B65';
    ctx.fillRect(50, tblY, totalW, 40);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 15px "Cairo", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('العبارات (مؤشرات السلوك)', W - 70, tblY + 26);
    ctx.textAlign = 'center';
    ctx.fillText('يوجد', 50 + colW.notes + colW.no + colW.med + colW.yes / 2, tblY + 26);
    ctx.fillText('متوسط', 50 + colW.notes + colW.no + colW.med / 2, tblY + 26);
    ctx.fillText('لا يوجد', 50 + colW.notes + colW.no / 2, tblY + 26);
    ctx.fillText('ملاحظات', 50 + colW.notes / 2, tblY + 26);

    var curY = tblY + 40;
    var rowH = 49;

    var itemsList = [
      'الاستقرار داخل القسم',
      'التواصل اللفظي مثل القدرة على تكرار الكلمات وفهم التعليمات اللفظية، والتعبير عن الاحتياجات',
      'التواصل غير اللفظي مثل الإشارات والرموز...',
      'الاستقلالية والمساعدة الذاتية',
      'التقليد',
      'الاستماع والاستجابة للأوامر وللتعليمات',
      'الطلب والاختيار',
      'التفاعل الاجتماعي واللعب وبناء علاقات مع الاقران ومع الغير',
      'الحركية الكبرى والتناسق الحركي',
      'الانتباه البصري',
      'الانتباه السمعي',
      'الانتباه اللمسي',
      'العصبية والعناد',
      'السلوكيات الغير مقبولة ان وجدت',
      'السلوكيات النمطية ان وجدت',
      'المشاكل الحسية ان وجدت'
    ];

    itemsList.forEach(function (txt, idx) {
      var sv = itemsState[idx + 1] || {};
      ctx.fillStyle = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
      ctx.fillRect(50, curY, totalW, rowH);
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 1;
      ctx.strokeRect(50, curY, totalW, rowH);

      ctx.beginPath();
      var x1 = 50 + colW.notes; ctx.moveTo(x1, curY); ctx.lineTo(x1, curY + rowH);
      var x2 = x1 + colW.no; ctx.moveTo(x2, curY); ctx.lineTo(x2, curY + rowH);
      var x3 = x2 + colW.med; ctx.moveTo(x3, curY); ctx.lineTo(x3, curY + rowH);
      var x4 = x3 + colW.yes; ctx.moveTo(x4, curY); ctx.lineTo(x4, curY + rowH);
      ctx.stroke();

      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 12.5px "Cairo", sans-serif';
      ctx.textAlign = 'right';
      if (txt.length > 55) {
        var p1 = txt.slice(0, 50);
        var p2 = txt.slice(50);
        ctx.fillText(p1, W - 65, curY + 19);
        ctx.font = '11px "Cairo", sans-serif';
        ctx.fillStyle = '#475569';
        ctx.fillText(p2, W - 65, curY + 36);
      } else {
        ctx.fillText(txt, W - 65, curY + 30);
      }

      ctx.textAlign = 'center';
      if (sv.val === 'يوجد') {
        ctx.fillStyle = '#2563EB'; ctx.font = 'bold 20px sans-serif';
        ctx.fillText('✔', x3 + colW.yes / 2, curY + 32);
      } else if (sv.val === 'متوسط') {
        ctx.fillStyle = '#F59E0B'; ctx.font = 'bold 20px sans-serif';
        ctx.fillText('✔', x2 + colW.med / 2, curY + 32);
      } else if (sv.val === 'لا يوجد') {
        ctx.fillStyle = '#64748B'; ctx.font = 'bold 20px sans-serif';
        ctx.fillText('✔', x1 + colW.no / 2, curY + 32);
      }

      if (sv.note) {
        ctx.fillStyle = '#1E293B'; ctx.font = '11.5px "Cairo", sans-serif';
        ctx.fillText(sv.note, 50 + colW.notes / 2, curY + 30);
      }

      curY += rowH;
    });

    // ملاحظات إضافية
    curY += 15;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#163B65';
    ctx.font = 'bold 16px "Cairo", sans-serif';
    ctx.fillText('ملاحظات إضافية:', W - 60, curY);
    curY += 22;

    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(50, curY, totalW, 110);
    ctx.strokeStyle = '#CBD5E1';
    ctx.strokeRect(50, curY, totalW, 110);
    if (obs.additional_notes) {
      ctx.fillStyle = '#1E293B';
      ctx.font = '14px "Cairo", sans-serif';
      ctx.fillText(obs.additional_notes, W - 70, curY + 30);
    }

    // إمضاء المدير دون رسم خانة
    curY += 135;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#163B65';
    ctx.font = 'bold 18px "Cairo", sans-serif';
    ctx.fillText('إمضاء المدير', 180, curY);

    return await exportCanvasToPdfBytes(c, 'a4');
  }


  /* ══════════════════════════════════════════════════════════════════════════
     تصدير تقييم قياس السلوك المستهدف إلى PDF بدقة A4 (مطابق تماماً لملف قياس السلوك المستهدف)
     ══════════════════════════════════════════════════════════════════════════ */
  async function renderTargetBehaviorToPdf(rep, childFullName, secName, kd) {
    if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch (e) {}
    }
    var logoImg = await loadLogoImage();
    var ev = ensureParsedEval(rep);
    var tb = ev.target_behavior_eval || rep.target_behavior_eval || {};
    var days = Array.isArray(tb.days) ? tb.days : [];
    var W = 1240, H = 1754, M = 64, CW = W - M * 2;

    var chName = childFullName || (kd && kd.full_name) || ev.child_name || tb.child_name || '—';
    var ageVal = tb.age || (kd && kd.dob ? (function (dob) {
      try {
        var bd = new Date(dob); var td = new Date(); var a = td.getFullYear() - bd.getFullYear();
        return a > 0 ? (a + ' سنوات') : '—';
      } catch (e) { return '—'; }
    })(kd.dob) : '—');
    var behaviorTitle = tb.selected_behaviors_text || (Array.isArray(tb.selected_behaviors) && tb.selected_behaviors.length ? tb.selected_behaviors.join(' ، ') : '—');

    // تجميع السلوكيات الرئيسية والفرعية المختارة للجدول
    var groupedMainSubs = [];
    var mainMap = {};
    if (Array.isArray(tb.selected_pairs) && tb.selected_pairs.length) {
      tb.selected_pairs.forEach(function (p) {
        if (!p || !p.main) return;
        var mKey = String(p.main).trim();
        if (!mainMap[mKey]) { mainMap[mKey] = []; groupedMainSubs.push({ main: mKey, subs: mainMap[mKey] }); }
        if (p.sub && mainMap[mKey].indexOf(p.sub) < 0) mainMap[mKey].push(p.sub);
      });
    }
    if (Array.isArray(tb.selected_mains) && tb.selected_mains.length) {
      tb.selected_mains.forEach(function (m) {
        var mKey = String(m || '').trim();
        if (mKey && !mainMap[mKey]) { mainMap[mKey] = []; groupedMainSubs.push({ main: mKey, subs: mainMap[mKey] }); }
      });
    }

    var pages = [];
    function createPage(isFirstPage) {
      var c = document.createElement('canvas');
      c.width = W; c.height = H;
      var ctx = c.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, W, H);
      ctx.direction = 'rtl';

      // الشعار الرسمي في أعلى جميع صفحات الوثيقة
      if (logoImg) {
        ctx.drawImage(logoImg, W - M - 88, 36, 88, 88);
      }

      var y = 85;
      ctx.fillStyle = '#1B365D';
      ctx.font = 'bold 28px "Cairo", "IBM Plex Sans Arabic", sans-serif';
      ctx.textAlign = 'center';
      var titleTxt = 'قياس السلوك المستهدف';
      ctx.fillText(titleTxt, W / 2, y);
      var tw = ctx.measureText(titleTxt).width;
      ctx.strokeStyle = '#1B365D';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(W / 2 - tw / 2 - 6, y + 8);
      ctx.lineTo(W / 2 + tw / 2 + 6, y + 8);
      ctx.stroke();

      y += 54;
      if (isFirstPage) {
        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 19px "Cairo", "IBM Plex Sans Arabic", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('اسم الطفل: ' + chName, W - M, y);
        ctx.fillText('العمر: ' + ageVal, M + 320, y);
        y += 34;

        // جدول السلوك الرئيسي والسلوكيات المختارة (عند اختيار سلوك رئيسي أو أكثر)
        if (groupedMainSubs.length > 0) {
          ctx.font = 'bold 17.5px "Cairo", "IBM Plex Sans Arabic", sans-serif';
          ctx.fillStyle = '#1B365D';
          ctx.fillText('جدول السلوك الرئيسي والسلوكيات المختارة:', W - M, y);
          y += 14;
          var gmW1 = Math.round(CW * 0.36);
          var gmW2 = CW - gmW1;
          var gmX1 = W - M - gmW1;
          var gmX2 = M;
          ctx.fillStyle = '#EFF6FF';
          ctx.fillRect(gmX1, y, gmW1, 34);
          ctx.fillRect(gmX2, y, gmW2, 34);
          ctx.strokeStyle = '#1B365D';
          ctx.lineWidth = 1.4;
          ctx.strokeRect(gmX1, y, gmW1, 34);
          ctx.strokeRect(gmX2, y, gmW2, 34);
          ctx.fillStyle = '#1B365D';
          ctx.font = 'bold 16px "Cairo", "IBM Plex Sans Arabic", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('السلوك الرئيسي', gmX1 + gmW1 / 2, y + 23);
          ctx.fillText('السلوكيات المختارة', gmX2 + gmW2 / 2, y + 23);
          y += 34;

          groupedMainSubs.forEach(function (gm) {
            ctx.font = '15px "Cairo", "IBM Plex Sans Arabic", sans-serif';
            var mLines = wrapLines(ctx, gm.main, gmW1 - 16, 0);
            var sTxt = gm.subs.length ? gm.subs.join(' — ') : '—';
            var sLines = wrapLines(ctx, sTxt, gmW2 - 16, 0);
            var rh = Math.max(32, Math.max(mLines.length, sLines.length) * 22 + 12);
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(gmX1, y, gmW1, rh);
            ctx.fillRect(gmX2, y, gmW2, rh);
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 1.2;
            ctx.strokeRect(gmX1, y, gmW1, rh);
            ctx.strokeRect(gmX2, y, gmW2, rh);
            ctx.fillStyle = '#0F172A';
            ctx.textAlign = 'right';
            ctx.font = 'bold 15px "Cairo", "IBM Plex Sans Arabic", sans-serif';
            mLines.forEach(function (ln, li) { ctx.fillText(ln, gmX1 + gmW1 - 10, y + 22 + li * 22); });
            ctx.font = '15px "Cairo", "IBM Plex Sans Arabic", sans-serif';
            sLines.forEach(function (ln, li) { ctx.fillText(ln, gmX2 + gmW2 - 10, y + 22 + li * 22); });
            y += rh;
          });
          y += 18;
        } else {
          ctx.font = 'bold 18px "Cairo", "IBM Plex Sans Arabic", sans-serif';
          var bLines = wrapLines(ctx, 'السلوك: ' + behaviorTitle, CW, 0);
          bLines.forEach(function (bl) {
            ctx.fillText(bl, W - M, y);
            y += 28;
          });
          y += 8;
        }

        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 19px "Cairo", "IBM Plex Sans Arabic", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('جدول القياس: التكرار + وقت ومدة السلوك', W - M, y);
        y += 16;
      }

      // ترويسة الجدول بـ 7 أعمدة (فصل خانة وقت السلوك عن خانة مدة السلوك)
      var colW = [155, 170, 120, 120, 130, 175, CW - (155 + 170 + 120 + 120 + 130 + 175)];
      var colX = [];
      var curX = W - M;
      for (var i = 0; i < colW.length; i++) {
        curX -= colW[i];
        colX.push(curX);
      }
      var hdrH = 74;
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(M, y, CW, hdrH);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.6;
      for (var cIdx = 0; cIdx < colW.length; cIdx++) {
        ctx.strokeRect(colX[cIdx], y, colW[cIdx], hdrH);
      }

      ctx.fillStyle = '#000000';
      ctx.font = 'bold 16.5px "Cairo", "IBM Plex Sans Arabic", sans-serif';
      ctx.textAlign = 'center';
      var headers = [
        ['اليوم والتاريخ'],
        ['نوع السلوك'],
        ['وقت', 'السلوك'],
        ['مدة', 'السلوك'],
        ['عدد مرات', 'التكرار'],
        ['مكان حدوث', 'السلوك'],
        ['سوابق حدوث', 'السلوك']
      ];
      headers.forEach(function (hLines, idx) {
        var cx = colX[idx] + colW[idx] / 2;
        var startHy = y + (hLines.length === 1 ? 44 : 30);
        hLines.forEach(function (ln, lIdx) {
          ctx.fillText(ln, cx, startHy + lIdx * 22);
        });
      });

      var pObj = { canvas: c, ctx: ctx, y: y + hdrH, colW: colW, colX: colX };
      pages.push(pObj);
      return pObj;
    }

    var curPage = createPage(true);

    days.forEach(function (dayObj) {
      var rawRows = Array.isArray(dayObj.rows) ? dayObj.rows : [];
      var filledRows = rawRows.filter(function (r) {
        return r && (r.sub_behavior || r.behavior_time || r.behavior_duration || r.time_duration || r.frequency || r.location || r.antecedents);
      });
      var rows = filledRows.length ? filledRows : (rawRows.length ? [rawRows[0]] : [{ sub_behavior: '', behavior_time: '', behavior_duration: '', frequency: '', location: '', antecedents: '' }]);

      // حساب ارتفاع كل صف ديناميكياً حتى ينتهي الجدول عند نهاية الكتابة دون اقتطاع أو فراغ
      var ctxMeasure = curPage.ctx;
      var colW = curPage.colW;
      var rowHeights = rows.map(function (rItem) {
        var bTime = rItem.behavior_time || '';
        var bDur = rItem.behavior_duration || '';
        if (!bTime && !bDur && rItem.time_duration) bDur = rItem.time_duration;
        var vals = [
          rItem.sub_behavior || '',
          bTime,
          bDur,
          rItem.frequency || '',
          rItem.location || '',
          rItem.antecedents || ''
        ];
        var maxL = 1;
        ctxMeasure.font = '14.5px "Cairo", "IBM Plex Sans Arabic", sans-serif';
        vals.forEach(function (v, vi) {
          if (v) {
            var wl = wrapLines(ctxMeasure, String(v), colW[vi + 1] - 12, 0);
            if (wl.length > maxL) maxL = wl.length;
          }
        });
        return Math.max(38, maxL * 22 + 14);
      });

      var blockH = rowHeights.reduce(function (a, b) { return a + b; }, 0);
      if (blockH < 48) { rowHeights[0] += (48 - blockH); blockH = 48; }
      if (curPage.y + blockH > H - 65) {
        curPage = createPage(false);
      }
      var ctx = curPage.ctx;
      colW = curPage.colW;
      var colX = curPage.colX;
      var startY = curPage.y;

      // خلية اليوم والتاريخ مدمجة عمودياً
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(colX[0], startY, colW[0], blockH);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.4;
      ctx.strokeRect(colX[0], startY, colW[0], blockH);

      ctx.fillStyle = '#000000';
      ctx.font = 'bold 15px "Cairo", "IBM Plex Sans Arabic", sans-serif';
      ctx.textAlign = 'center';
      var dayNameStr = dayObj.day_name || '';
      var dateFmtStr = dayObj.date_display || dayObj.date || '';
      if (dayNameStr && dateFmtStr) {
        ctx.fillText(dayNameStr, colX[0] + colW[0] / 2, startY + blockH / 2 - 4);
        ctx.fillText(dateFmtStr, colX[0] + colW[0] / 2, startY + blockH / 2 + 18);
      } else {
        ctx.fillText(dayNameStr || dateFmtStr, colX[0] + colW[0] / 2, startY + blockH / 2 + 6);
      }

      var curRy = startY;
      rows.forEach(function (rItem, rIdx) {
        var rH = rowHeights[rIdx];
        var bTime = rItem.behavior_time || '';
        var bDur = rItem.behavior_duration || '';
        if (!bTime && !bDur && rItem.time_duration) bDur = rItem.time_duration;
        var vals = [
          rItem.sub_behavior || '',
          bTime,
          bDur,
          rItem.frequency || '',
          rItem.location || '',
          rItem.antecedents || ''
        ];
        for (var cIdx = 1; cIdx < 7; cIdx++) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(colX[cIdx], curRy, colW[cIdx], rH);
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 1.3;
          ctx.strokeRect(colX[cIdx], curRy, colW[cIdx], rH);

          var cellTxt = String(vals[cIdx - 1] || '');
          if (cellTxt) {
            ctx.fillStyle = '#000000';
            ctx.font = (cIdx === 1 ? 'bold 14.5px ' : '14.5px ') + '"Cairo", "IBM Plex Sans Arabic", sans-serif';
            ctx.textAlign = 'center';
            var wrapped = wrapLines(ctx, cellTxt, colW[cIdx] - 12, 0);
            var startTy = curRy + 24;
            wrapped.forEach(function (ln, li) {
              ctx.fillText(ln, colX[cIdx] + colW[cIdx] / 2, startTy + li * 22);
            });
          }
        }
        curRy += rH;
      });

      curPage.y += blockH;
    });

    var jpegPages = [];
    for (var k = 0; k < pages.length; k++) {
      var jpgBytes = await canvasToJpegBytes(pages[k].canvas, 0.95);
      jpegPages.push({ data: jpgBytes, width: W, height: H });
    }
    return buildPdfBinary(jpegPages);
  }

  /* ══════════════════════════════════════════════════════════════════════════
     تصدير استمارة تقييم دوافع السلوك MAS إلى PDF بدقة A4 (مطابقة للوثيقة المرفقة بدون خانة المتوسط)
     ══════════════════════════════════════════════════════════════════════════ */
  var MAS_HEADINGS_REGEX = /^(السلوك وتعريفه الإجرائي|البيئة محط المسح|التحليل|النتيجة|توصيات مبنية على النتيجة)\s*:?/i;

  function drawMasFormattedTextOnCanvas(ctx, text, rightX, startY, maxW, maxY) {
    var y = startY;
    var rawLines = String(text || '').replace(/\r\n/g, '\n').split('\n');
    rawLines.forEach(function (rawLn) {
      var trimmed = rawLn.trim();
      if (!trimmed) {
        y += 14;
        return;
      }
      var cleanLn = trimmed.replace(/^[🎯🟢📝💡📌•\-]+\s*/, '');
      var m = MAS_HEADINGS_REGEX.exec(cleanLn);
      if (m) {
        if (y > maxY) return;
        var headingPart = m[1] + ':';
        var restPart = cleanLn.slice(m[0].length).trim();
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 18px "Cairo", "IBM Plex Sans Arabic", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(headingPart, rightX, y);
        var hWidth = ctx.measureText(headingPart).width;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(rightX, y + 5);
        ctx.lineTo(rightX - hWidth, y + 5);
        ctx.stroke();
        y += 28;
        if (restPart) {
          ctx.font = '16px "Cairo", "IBM Plex Sans Arabic", sans-serif';
          var wRest = wrapLines(ctx, restPart, maxW, 6);
          wRest.forEach(function (wLn) {
            if (y <= maxY) {
              ctx.fillText(wLn, rightX, y);
              y += 25;
            }
          });
        }
      } else {
        ctx.fillStyle = '#000000';
        ctx.font = '16px "Cairo", "IBM Plex Sans Arabic", sans-serif';
        ctx.textAlign = 'right';
        var wLines = wrapLines(ctx, cleanLn, maxW, 6);
        wLines.forEach(function (wLn) {
          if (y <= maxY) {
            ctx.fillText(wLn, rightX, y);
            y += 25;
          }
        });
      }
    });
    return y;
  }

  async function renderMasBehaviorToPdf(rep, childFullName, secName, kd) {
    if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch (e) {}
    }
    var logoImg = await loadLogoImage();
    var ev = ensureParsedEval(rep);
    var mas = ev.mas_eval || rep.mas_eval || ev.mas || {};
    var answers = mas.answers || {};
    var W = 1240, H = 1754, M = 64, CW = W - M * 2;

    var chName = childFullName || (kd && kd.full_name) || ev.child_name || mas.child_name || '—';
    var informant = mas.informant || mas.examiner || '—';
    var dateVal = mas.report_date || ev.report_date || new Date().toISOString().slice(0, 10);
    var mDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateVal).trim());
    var dateFmt = mDate ? (mDate[3] + '/' + mDate[2] + '/' + mDate[1]) : String(dateVal);

    var masItems = [
      'هل يتكرر السلوك باستمرار مراراً وتكراراً إذا ترك الشخص لوحده لفترات طويلة لساعات مثلاً.',
      'هل يظهر السلوك عند الطلب منه أن يقوم بمهمة صعبة؟',
      'هل يظهر السلوك كاستجابة لتحدثك مع آخرين في الغرفة؟',
      'هل يظهر السلوك كوسيلة للحصول على لعبة، طعام، أو نشاط قد أخبر المفحوص أنه لن يحصل عليه.',
      'هل يتكرر السلوك بنفس الطريقة لفترات طويلة جداً إذا لم يكن هناك أحد حوله هز الجسم لأكثر من ساعة.',
      'هل يظهر السلوك عند إعطاء المفحوص تعليمات وأوامر؟',
      'هل يظهر السلوك عندما توقف انتباهك للمفحوص؟',
      'هل يظهر السلوك عندما تأخذ لعبة مفضلة، طعام، أو نشاط منه؟',
      'هل يبدو لك أن المفحوص يستمتع بالقيام بالسلوك (يحب ملمس، مذاق، منظر، رائحة، أو صوت المثير المسلكي)؟',
      'هل يبدو لك أن المفحوص يقوم بالسلوك ليزعجك أو يغضبك عند محاولتك لجعله يتبع تعليماتك؟',
      'هل يبدو لك أن المفحوص يقوم بالسلوك ليزعجك أو يغضبك عندما تعطيه انتباهك؟ (إذا كنت في غرفة أخرى أو تحدث شخصاً آخر).',
      'هل يتوقف السلوك إذا أعطيت المفحوص اللعبة، الطعام أو النشاط الذي طلبه؟',
      'خلال القيام بالسلوك هل يظهر المفحوص هادئاً وغير واعٍ لأي شيء آخر يحدث حوله؟',
      'هل يتوقف السلوك (خلال 1-5 دقائق) من إيقافك لتشغيل المفحوص أو إعطائه تعليمات؟',
      'هل يبدو لك أن المفحوص يقوم بالسلوك لحملك على قضاء بعض الوقت معه؟',
      'هل يبدو أن السلوك يظهر عند إخبار المفحوص بأنه لن يقوم بشيء أراد القيام به؟'
    ];

    // الصفحة الأولى: الترويسة + السلوك وتعريفه الإجرائي + البيئة محط المسح + جدول البنود (1 إلى 13)
    var c1 = document.createElement('canvas');
    c1.width = W; c1.height = H;
    var ctx1 = c1.getContext('2d');
    ctx1.fillStyle = '#FFFFFF';
    ctx1.fillRect(0, 0, W, H);
    ctx1.direction = 'rtl';
    if (logoImg) { ctx1.drawImage(logoImg, M, 22, 82, 82); }

    var y = 80;
    ctx1.fillStyle = '#000000';
    ctx1.font = 'bold 26px "Cairo", "IBM Plex Sans Arabic", sans-serif';
    ctx1.textAlign = 'center';
    ctx1.fillText('استمارة تقييم دوافع السلوك MAS', W / 2, y);
    y += 42;

    ctx1.font = 'bold 19px "Cairo", "IBM Plex Sans Arabic", sans-serif';
    ctx1.textAlign = 'right';
    ctx1.fillText('اسم الحالة: ' + chName, W - M, y);
    ctx1.fillText('مقدم المعلومات: ' + informant, W - M - 430, y);
    ctx1.fillText('التاريخ: ' + dateFmt, M + 230, y);
    y += 38;

    var introBlock = mas.intro_text || ('السلوك وتعريفه الإجرائي:\n' + (mas.behavior_definition || '') + '\nالبيئة محط المسح: ' + (mas.environment || 'المركز و المنزل'));
    y = drawMasFormattedTextOnCanvas(ctx1, introBlock, W - M, y, CW, 430);
    y += 12;

    // إعداد أعمدة جدول البنود (9 أعمدة من اليمين لليسار: # | البند | مطلقا 0 | شبه مطلقا 1 | نادرا 2 | نصف الوقت 3 | عادة 4 | أغلب الأحيان 5 | دائما 6)
    var qColW = [46, 512, 80, 84, 80, 84, 80, 84, 78];
    var qColX = [];
    var curQx = W - M;
    for (var qi = 0; qi < qColW.length; qi++) {
      curQx -= qColW[qi];
      qColX.push(curQx);
    }

    function drawMasItemsHeader(ctx, topY) {
      var hH = 74;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(M, topY, CW, hH);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.4;
      for (var i = 0; i < qColW.length; i++) {
        ctx.strokeRect(qColX[i], topY, qColW[i], hH);
      }
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 15px "Cairo", "IBM Plex Sans Arabic", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('#', qColX[0] + qColW[0] / 2, topY + 32);
      ctx.fillText('البند', qColX[1] + qColW[1] / 2, topY + 32);

      var scaleHdrs = [
        ['مطلقا', '', '0'],
        ['شبه', 'مطلقا', '1'],
        ['نادرا', '', '2'],
        ['نصف', 'الوقت', '3'],
        ['عادة', '', '4'],
        ['أغلب', 'الأحيان', '5'],
        ['دائما', '', '6']
      ];
      scaleHdrs.forEach(function (sh, sIdx) {
        var cx = qColX[sIdx + 2] + qColW[sIdx + 2] / 2;
        ctx.fillText(sh[0], cx, topY + 22);
        if (sh[1]) ctx.fillText(sh[1], cx, topY + 42);
        ctx.fillText(sh[2], cx, topY + 64);
      });
      return topY + hH;
    }

    function drawMasItemRow(ctx, itemIdx, topY) {
      var qNum = itemIdx + 1;
      var qText = masItems[itemIdx];
      ctx.font = 'bold 15px "Cairo", "IBM Plex Sans Arabic", sans-serif';
      var qLines = wrapLines(ctx, qText, qColW[1] - 18, 3);
      var rH = Math.max(54, qLines.length * 24 + 14);

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(M, topY, CW, rH);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.2;
      for (var i = 0; i < qColW.length; i++) {
        ctx.strokeRect(qColX[i], topY, qColW[i], rH);
      }

      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.font = 'bold 15px "Cairo", sans-serif';
      ctx.fillText(String(qNum), qColX[0] + qColW[0] / 2, topY + 28);

      ctx.font = 'bold 14.5px "Cairo", "IBM Plex Sans Arabic", sans-serif';
      qLines.forEach(function (ln, lIdx) {
        ctx.fillText(ln, qColX[1] + qColW[1] / 2, topY + 24 + lIdx * 22);
      });

      var chosenVal = answers[qNum];
      if (chosenVal !== '' && chosenVal != null && !isNaN(parseInt(chosenVal, 10))) {
        var scInt = parseInt(chosenVal, 10);
        if (scInt >= 0 && scInt <= 6) {
          var colIdx = 2 + scInt;
          ctx.font = 'bold 18px sans-serif';
          ctx.fillText('X', qColX[colIdx] + qColW[colIdx] / 2, topY + rH / 2 + 6);
        }
      }
      return topY + rH;
    }

    y = drawMasItemsHeader(ctx1, y);
    for (var i1 = 0; i1 < 13; i1++) {
      y = drawMasItemRow(ctx1, i1, y);
    }

    // الصفحة الثانية: البنود (14 إلى 16) + جدول النتائج تلقائياً (بدون خانة المتوسط) + التحليل والنتيجة والتوصيات
    var c2 = document.createElement('canvas');
    c2.width = W; c2.height = H;
    var ctx2 = c2.getContext('2d');
    ctx2.fillStyle = '#FFFFFF';
    ctx2.fillRect(0, 0, W, H);
    ctx2.direction = 'rtl';

    var y2 = 75;
    for (var i2 = 13; i2 < 16; i2++) {
      y2 = drawMasItemRow(ctx2, i2, y2);
    }

    y2 += 45;
    // عنوان: النتائج
    ctx2.fillStyle = '#000000';
    ctx2.font = 'bold 22px "Cairo", "IBM Plex Sans Arabic", sans-serif';
    ctx2.textAlign = 'center';
    ctx2.fillText('النتائج', W / 2, y2);
    var rTw = ctx2.measureText('النتائج').width;
    ctx2.strokeStyle = '#000000';
    ctx2.lineWidth = 1.8;
    ctx2.beginPath();
    ctx2.moveTo(W / 2 - rTw / 2 - 4, y2 + 6);
    ctx2.lineTo(W / 2 + rTw / 2 + 4, y2 + 6);
    ctx2.stroke();
    y2 += 20;

    // حساب جدول النتائج تلقائياً بدون خانة المتوسط
    var factors = [
      { key: 'sensory', title: 'استثارة ذاتية', items: [1, 5, 9, 13] },
      { key: 'escape', title: 'هروب', items: [2, 6, 10, 14] },
      { key: 'attention', title: 'انتباه', items: [3, 7, 11, 15] },
      { key: 'tangible', title: 'أنشطة / أشياء\nمفضلة', items: [4, 8, 12, 16] }
    ];
    factors.forEach(function (f) {
      var sum = 0;
      f.scores = f.items.map(function (qNum) {
        var v = answers[qNum];
        var n = (v !== '' && v != null && !isNaN(parseInt(v, 10))) ? parseInt(v, 10) : 0;
        sum += n;
        return { qNum: qNum, score: (v !== '' && v != null && !isNaN(parseInt(v, 10))) ? n : '' };
      });
      f.total = sum;
    });

    // حساب الترتيب حسب أعلى مجموع (مع إعطاء نفس الترتيب عند التساوي كما في الوثيقة الرسمية)
    var uniqueTotals = [];
    factors.slice().sort(function (a, b) { return b.total - a.total; }).forEach(function (f) {
      if (uniqueTotals.indexOf(f.total) < 0) uniqueTotals.push(f.total);
    });
    factors.forEach(function (f) {
      var higherCount = factors.filter(function (other) { return other.total > f.total; }).length;
      f.rank = higherCount + 1;
    });

    var rColW = [190, 234, 234, 234, 236];
    var rColX = [];
    var curRx = W - M;
    for (var ri = 0; ri < rColW.length; ri++) {
      curRx -= rColW[ri];
      rColX.push(curRx);
    }

    // ترويسة جدول النتائج
    var rHdrH = 68;
    ctx2.strokeStyle = '#000000';
    ctx2.lineWidth = 1.4;
    for (var rc = 0; rc < 5; rc++) {
      ctx2.strokeRect(rColX[rc], y2, rColW[rc], rHdrH);
    }
    ctx2.fillStyle = '#000000';
    ctx2.font = 'bold 18px "Cairo", "IBM Plex Sans Arabic", sans-serif';
    ctx2.textAlign = 'center';
    ctx2.fillText('العامل الوظيفي', rColX[0] + rColW[0] / 2, y2 + 38);
    factors.forEach(function (f, fIdx) {
      var lns = f.title.split('\n');
      var cx = rColX[fIdx + 1] + rColW[fIdx + 1] / 2;
      if (lns.length > 1) {
        ctx2.fillText(lns[0], cx, y2 + 28);
        ctx2.fillText(lns[1], cx, y2 + 54);
      } else {
        ctx2.fillText(lns[0], cx, y2 + 38);
      }
    });
    y2 += rHdrH;

    // 4 صفوف للبنود
    for (var rowIdx = 0; rowIdx < 4; rowIdx++) {
      var rowH = 44;
      for (var cIdx = 0; cIdx < 5; cIdx++) {
        ctx2.strokeRect(rColX[cIdx], y2, rColW[cIdx], rowH);
      }
      ctx2.font = 'bold 17px "Cairo", sans-serif';
      ctx2.textAlign = 'center';
      factors.forEach(function (f, fIdx) {
        var itemObj = f.scores[rowIdx];
        var scTxt = itemObj.score !== '' ? String(itemObj.score) : '0';
        var formatted = '.' + itemObj.qNum + '   ---' + scTxt + '---';
        ctx2.fillText(formatted, rColX[fIdx + 1] + rColW[fIdx + 1] / 2, y2 + 28);
      });
      y2 += rowH;
    }

    // صف المجموع (في خانة وحدها بدون خانة المتوسط!)
    var totRowH = 48;
    for (var tc = 0; tc < 5; tc++) {
      ctx2.strokeRect(rColX[tc], y2, rColW[tc], totRowH);
    }
    ctx2.font = 'bold 18px "Cairo", "IBM Plex Sans Arabic", sans-serif';
    ctx2.fillText('المجموع', rColX[0] + rColW[0] / 2, y2 + 31);
    factors.forEach(function (f, fIdx) {
      ctx2.fillText('____' + f.total + '____', rColX[fIdx + 1] + rColW[fIdx + 1] / 2, y2 + 31);
    });
    y2 += totRowH;

    // صف الترتيب المعياري (مباشرة تحت المجموع بدون خانة المتوسط)
    var rnkRowH = 56;
    for (var kc = 0; kc < 5; kc++) {
      ctx2.strokeRect(rColX[kc], y2, rColW[kc], rnkRowH);
    }
    ctx2.font = 'bold 17px "Cairo", "IBM Plex Sans Arabic", sans-serif';
    ctx2.fillText('الترتيب', rColX[0] + rColW[0] / 2, y2 + 24);
    ctx2.fillText('المعياري', rColX[0] + rColW[0] / 2, y2 + 46);
    factors.forEach(function (f, fIdx) {
      ctx2.font = 'bold 18px "Cairo", sans-serif';
      ctx2.fillText('____' + f.rank + '____', rColX[fIdx + 1] + rColW[fIdx + 1] / 2, y2 + 34);
    });
    y2 += rnkRowH + 42;

    // الكتابة السفلية (التحليل، النتيجة، توصيات مبنية على النتيجة) مع تغليظ وتسطير العناوين تلقائياً
    var outroBlock = mas.outro_text || (
      'التحليل:\n' + (mas.analysis || '') + '\n' +
      'النتيجة:\n' + (mas.result_summary || '') + '\n' +
      'توصيات مبنية على النتيجة:\n' + (mas.recommendations || '')
    );
    drawMasFormattedTextOnCanvas(ctx2, outroBlock, W - M, y2, CW, H - 70);

    var jpg1 = await canvasToJpegBytes(c1, 0.95);
    var jpg2 = await canvasToJpegBytes(c2, 0.95);
    return buildPdfBinary([
      { data: jpg1, width: W, height: H },
      { data: jpg2, width: W, height: H }
    ]);
  }


  /* ══════════════════════════════════════════════════════════════════════════
     حساب إحصائيات ونتائج تقرير قياس السلوك المستهدف تلقائياً من جدول التقييم
     ══════════════════════════════════════════════════════════════════════════ */
  function normalizeArDigitsPdf(str) {
    var s = String(str || '');
    var ar = '٠١٢٣٤٥٦٧٨٩';
    var fa = '۰۱۲۳۴۵۶۷۸۹';
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      var i1 = ar.indexOf(ch);
      var i2 = fa.indexOf(ch);
      if (i1 >= 0) out += String(i1);
      else if (i2 >= 0) out += String(i2);
      else out += ch;
    }
    return out;
  }

  function formatShortDateDDMM(isoOrDisp) {
    var s = String(isoOrDisp || '').trim();
    var m1 = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (m1) return m1[3] + '/' + m1[2];
    var m2 = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s);
    if (m2) return m2[1] + '/' + m2[2];
    return s.slice(0, 5) || '—';
  }

  function formatFullDateDDMMYYYY(isoOrDisp) {
    var s = String(isoOrDisp || '').trim();
    var m1 = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (m1) return m1[3] + '/' + m1[2] + '/' + m1[1];
    return s || '—';
  }

  function computeTargetBehaviorStats(tbEval, tbReport) {
    var tb = tbEval || {};
    var rep = tbReport || {};
    var days = Array.isArray(tb.days) ? tb.days : [];
    var dailyRows = [];
    var totalOccurrences = 0;
    var extractedDurations = [];
    var extractedAntecedents = [];
    var extractedLocations = [];

    days.forEach(function (dObj, idx) {
      var rows = Array.isArray(dObj.rows) ? dObj.rows : [];
      var daySum = 0;
      rows.forEach(function (rItem) {
        if (!rItem) return;
        var fRaw = normalizeArDigitsPdf(rItem.frequency || '').trim();
        var mNum = /(\d+(?:\.\d+)?)/.exec(fRaw);
        if (mNum) {
          daySum += parseFloat(mNum[1]);
        } else if (rItem.sub_behavior && String(rItem.sub_behavior).trim()) {
          daySum += 1;
        }
        if (rItem.time_duration && String(rItem.time_duration).trim()) {
          var durTxt = String(rItem.time_duration).trim();
          if (extractedDurations.indexOf(durTxt) < 0) extractedDurations.push(durTxt);
        }
        if (rItem.antecedents && String(rItem.antecedents).trim()) {
          var antTxt = String(rItem.antecedents).trim();
          if (extractedAntecedents.indexOf(antTxt) < 0) extractedAntecedents.push(antTxt);
        }
        if (rItem.location && String(rItem.location).trim()) {
          var locTxt = String(rItem.location).trim();
          if (extractedLocations.indexOf(locTxt) < 0) extractedLocations.push(locTxt);
        }
      });
      totalOccurrences += daySum;
      dailyRows.push({
        day_name: dObj.day_name || ('اليوم ' + (idx + 1)),
        date_short: formatShortDateDDMM(dObj.date || dObj.date_display || ''),
        date_display: dObj.date_display || formatFullDateDDMMYYYY(dObj.date || ''),
        count: daySum
      });
    });

    var totalDays = dailyRows.length;
    var avgNum = totalDays > 0 ? (totalOccurrences / totalDays) : 0;
    var avgFmt = totalDays > 0 ? Number(avgNum.toFixed(2)).toString() : '0';

    var maxCount = 0;
    var minCount = totalDays > 0 ? dailyRows[0].count : 0;
    dailyRows.forEach(function (dr) {
      if (dr.count > maxCount) maxCount = dr.count;
      if (dr.count < minCount) minCount = dr.count;
    });

    var startDisp = tb.start_date ? formatFullDateDDMMYYYY(tb.start_date) : (dailyRows.length ? dailyRows[0].date_display : '—');
    var endDisp = tb.end_date ? formatFullDateDDMMYYYY(tb.end_date) : (dailyRows.length ? dailyRows[dailyRows.length - 1].date_display : '—');
    var periodText = (startDisp !== '—' && endDisp !== '—') ? (startDisp + ' – ' + endDisp) : (startDisp !== '—' ? startDisp : '—');

    var epDur = (rep.episode_duration && String(rep.episode_duration).trim())
      || (extractedDurations.length ? extractedDurations[0] : '10–45 ث');

    function formatArabicTimesWord(n) {
      if (n === 0) return '0 مرة';
      if (n === 1) return 'مرة واحدة';
      if (n === 2) return 'مرتان';
      if (n >= 3 && n <= 10) return n + ' مرات';
      return n + ' مرة';
    }

    var maxMinSummary = 'أعلى تكرار: ' + formatArabicTimesWord(maxCount) + ' خلال يوم واحد، وأقل تكرار: ' + formatArabicTimesWord(minCount) + '.';

    return {
      totalOccurrences: totalOccurrences,
      totalDays: totalDays,
      dailyAverage: avgNum,
      dailyAverageFmt: avgFmt,
      episodeDuration: epDur,
      maxCount: maxCount,
      minCount: minCount,
      maxMinSummary: maxMinSummary,
      periodText: periodText,
      dailyRows: dailyRows,
      extractedAntecedents: extractedAntecedents,
      extractedLocations: extractedLocations
    };
  }

  function drawReportTopGradientBar(ctx, W) {
    var grad = ctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, '#1B365D');
    grad.addColorStop(0.5, '#1D5B9E');
    grad.addColorStop(1, '#1E7E62');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, 24);
  }

  function drawSectionPillBanner(ctx, W, M, y, numStr, titleTxt, pillW) {
    var pw = pillW || 310;
    var ph = 48;
    var px = W - M - pw + 20;
    ctx.fillStyle = '#1B365D';
    roundRect(ctx, px, y, pw, ph, 24);
    ctx.fill();

    // الدائرة البيضاء للرقم على اليمين
    var cx = px + pw - 32;
    var cy = y + ph / 2;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(cx, cy, 16, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1B365D';
    ctx.font = 'bold 18px "Cairo", "IBM Plex Sans Arabic", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(numStr), cx, cy + 6);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 21px "Cairo", "IBM Plex Sans Arabic", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(titleTxt, cx - 26, cy + 7);

    return y + ph + 16;
  }

  function drawTargetBehaviorReportPage1(ctx, W, H, repData, logoImg) {
    var M = 68;
    var CW = W - M * 2;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);
    ctx.direction = 'rtl';

    drawReportTopGradientBar(ctx, W);

    var y = 66;
    // الشعار على اليمين أو اليسار كما في النموذج المرفق (أعلى اليمين في الصفحة)
    if (logoImg) {
      ctx.drawImage(logoImg, W - M - 115, 42, 115, 115);
    }

    ctx.fillStyle = '#64748B';
    ctx.font = '16px "Cairo", "IBM Plex Sans Arabic", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('المركز النفسي البيداغوجي لرعاية ذوي الاحتياجات الخاصة · دار الإحسان – العطف – غرداية', W / 2 - 30, y);

    y += 46;
    ctx.fillStyle = '#1B365D';
    ctx.font = 'bold 34px "Cairo", "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText('تقرير متابعة وقياس السلوك المستهدف', W / 2 - 30, y);

    y += 34;
    ctx.fillStyle = '#1E7E62';
    ctx.font = 'bold 18px "Cairo", "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText('رصد التكرار · تحليل السوابق · توصيات تربوية', W / 2 - 30, y);

    y += 30;
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(M, y);
    ctx.lineTo(W - M, y);
    ctx.stroke();

    y += 20;
    // 4 بطاقات معلومات الحالة (من اليمين لليسار)
    var cGap = 14;
    var w1 = 210, w2 = 175, w3 = 385, w4 = CW - w1 - w2 - w3 - cGap * 3;
    var cardSpecs = [
      { label: 'اسم الطفل', val: repData.childName || '—', w: w1 },
      { label: 'العمر', val: repData.ageText || '—', w: w2 },
      { label: 'السلوك المستهدف', val: repData.behaviorText || '—', w: w3 },
      { label: 'فترة المتابعة', val: repData.stats.periodText || '—', w: w4 }
    ];
    var curX = W - M;
    var cardH = 72;
    cardSpecs.forEach(function (cs) {
      curX -= cs.w;
      ctx.fillStyle = '#F1F5F9';
      roundRect(ctx, curX, y, cs.w, cardH, 10);
      ctx.fill();
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 1.2;
      roundRect(ctx, curX, y, cs.w, cardH, 10);
      ctx.stroke();

      ctx.fillStyle = '#64748B';
      ctx.font = '14px "Cairo", "IBM Plex Sans Arabic", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(cs.label, curX + cs.w - 14, y + 24);

      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 17px "Cairo", "IBM Plex Sans Arabic", sans-serif';
      var valWrapped = wrapLines(ctx, String(cs.val || '—'), cs.w - 24, 1);
      ctx.fillText(valWrapped[0] || '—', curX + cs.w - 14, y + 54);
      curX -= cGap;
    });

    y += cardH + 22;

    // 1. هدف المتابعة
    y = drawSectionPillBanner(ctx, W, M, y, '1', 'هدف المتابعة', 240);
    ctx.fillStyle = '#1E293B';
    ctx.font = '17.5px "Cairo", "IBM Plex Sans Arabic", sans-serif';
    ctx.textAlign = 'right';
    var goalTxt = repData.goalText || 'تهدف هذه المتابعة إلى رصد السلوك المستهدف وقياس معدل تكراره ومدته الزمنية، وتحديد الظروف والمواقف السابقة لحدوثه، من أجل فهم العوامل المرتبطة به وتحديد التدخل التربوي المناسب.';
    var goalLines = wrapLines(ctx, goalTxt, CW, 2);
    goalLines.forEach(function (gl) {
      ctx.fillText(gl, W - M, y + 10);
      y += 30;
    });
    y += 10;

    // 2. نتائج القياس
    y = drawSectionPillBanner(ctx, W, M, y, '2', 'نتائج القياس', 240);

    var st = repData.stats;
    var kpiGap = 16;
    var kpiW = (CW - kpiGap * 3) / 4;
    var kpiH = 92;
    var kpis = [
      { val: String(st.totalOccurrences), label: 'مجموع مرات حدوث السلوك', bg: '#1B365D' },
      { val: String(st.totalDays), label: 'عدد أيام المتابعة', bg: '#1E7E62' },
      { val: String(st.dailyAverageFmt), label: 'متوسط التكرار اليومي', bg: '#1D5B9E' },
      { val: String(st.episodeDuration), label: 'مدة النوبة الواحدة', bg: '#8B2635' }
    ];
    var kx = W - M;
    kpis.forEach(function (kp) {
      kx -= kpiW;
      ctx.fillStyle = kp.bg;
      roundRect(ctx, kx, y, kpiW, kpiH, 12);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 31px "Cairo", "IBM Plex Sans Arabic", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(kp.val, kx + kpiW / 2, y + 44);

      ctx.font = '15.5px "Cairo", "IBM Plex Sans Arabic", sans-serif';
      ctx.fillText(kp.label, kx + kpiW / 2, y + 74);
      kx -= kpiGap;
    });

    y += kpiH + 28;
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 17px "Cairo", "IBM Plex Sans Arabic", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(st.maxMinSummary, W - M, y);

    y += 18;
    // بطاقة منحنى تكرار السلوك اليومي
    var chartBoxH = 360;
    ctx.fillStyle = '#F8FAFC';
    roundRect(ctx, M, y, CW, chartBoxH, 14);
    ctx.fill();
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1.2;
    roundRect(ctx, M, y, CW, chartBoxH, 14);
    ctx.stroke();

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 20px "Cairo", "IBM Plex Sans Arabic", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('منحنى تكرار السلوك اليومي', W / 2, y + 36);

    var plotLeft = M + 56;
    var plotRight = W - M - 64;
    var plotTop = y + 72;
    var plotBottom = y + chartBoxH - 48;
    var plotW = plotRight - plotLeft;
    var plotH = plotBottom - plotTop;

    var maxAxis = Math.max(6, st.maxCount + 1);
    var stepAxis = maxAxis <= 8 ? 1 : Math.ceil(maxAxis / 6);

    ctx.font = '14px "Cairo", sans-serif';
    ctx.fillStyle = '#64748B';
    ctx.textAlign = 'center';
    ctx.fillText('مرات', plotRight + 30, plotTop - 16);

    for (var gv = 0; gv <= maxAxis; gv += stepAxis) {
      var gy = plotBottom - (gv / maxAxis) * plotH;
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(plotLeft, gy);
      ctx.lineTo(plotRight, gy);
      ctx.stroke();

      ctx.fillStyle = '#64748B';
      ctx.textAlign = 'left';
      ctx.fillText(String(gv), plotRight + 16, gy + 5);
    }

    var pts = [];
    var dRows = st.dailyRows || [];
    var nDays = dRows.length;
    if (nDays > 0) {
      for (var di = 0; di < nDays; di++) {
        // من اليمين إلى اليسار كما في التقرير المرفق
        var ratio = nDays === 1 ? 0.5 : (di / (nDays - 1));
        var px = plotRight - ratio * plotW;
        var py = plotBottom - (dRows[di].count / maxAxis) * plotH;
        pts.push({ x: px, y: py, count: dRows[di].count, label: dRows[di].date_short });
      }

      // تظليل أسفل المنحنى
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(pts[0].x, plotBottom);
      pts.forEach(function (pt) { ctx.lineTo(pt.x, pt.y); });
      ctx.lineTo(pts[pts.length - 1].x, plotBottom);
      ctx.closePath();
      ctx.fillStyle = 'rgba(29, 91, 158, 0.12)';
      ctx.fill();
      ctx.restore();

      // خط المتوسط المتقطع
      var avgY = plotBottom - (st.dailyAverage / maxAxis) * plotH;
      ctx.save();
      ctx.strokeStyle = '#8B2635';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(plotLeft, avgY);
      ctx.lineTo(plotRight, avgY);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = '#8B2635';
      ctx.font = 'bold 14px "Cairo", "IBM Plex Sans Arabic", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('المتوسط ' + st.dailyAverageFmt, plotLeft + 10, avgY - 8);

      // رسم الخط الرئيسي للمنحنى
      ctx.strokeStyle = '#1D5B9E';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      pts.forEach(function (pt, idx) {
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();

      // النقاط والقيم والتواريخ
      pts.forEach(function (pt) {
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#1D5B9E';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = '#1B365D';
        ctx.font = 'bold 16px "Cairo", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(pt.count), pt.x, pt.y - 14);

        ctx.fillStyle = '#334155';
        ctx.font = '14px "Cairo", sans-serif';
        ctx.fillText(pt.label, pt.x, plotBottom + 26);
      });
    }

    y += chartBoxH + 20;

    // الصف السفلي: بطاقة مقياس متوسط التكرار اليومي (يمين) + بطاقة جدول التكرار اليومي (يسار)
    var botGap = 18;
    var halfW = (CW - botGap) / 2;
    var botH = 445;
    var rightBoxX = W - M - halfW;
    var leftBoxX = M;

    // 1. بطاقة مقياس متوسط التكرار اليومي (على اليمين)
    ctx.fillStyle = '#F8FAFC';
    roundRect(ctx, rightBoxX, y, halfW, botH, 14);
    ctx.fill();
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1.2;
    roundRect(ctx, rightBoxX, y, halfW, botH, 14);
    ctx.stroke();

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 20px "Cairo", "IBM Plex Sans Arabic", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('مقياس متوسط التكرار اليومي', rightBoxX + halfW / 2, y + 40);

    // رسم عداد نصف الدائرة (الساعة) بثلاث مجالات: الأخضر (1-5 منخفض)، البرتقالي (6-10 متوسط)، الأحمر (11+ مرتفع)
    var gCx = rightBoxX + halfW / 2;
    var gCy = y + 265;
    var gRadius = 140;
    var gThickness = 36;
    var zoneDefs = [
      { color: '#22C55E', aStart: -Math.PI / 3, aEnd: 0, label: 'منخفض (1-5)' },
      { color: '#F97316', aStart: -(2 * Math.PI) / 3, aEnd: -Math.PI / 3, label: 'متوسط (6-10)' },
      { color: '#EF4444', aStart: -Math.PI, aEnd: -(2 * Math.PI) / 3, label: 'مرتفع (+11)' }
    ];
    zoneDefs.forEach(function (z) {
      ctx.beginPath();
      ctx.arc(gCx, gCy, gRadius, z.aStart, z.aEnd, false);
      ctx.strokeStyle = z.color;
      ctx.lineWidth = gThickness;
      ctx.stroke();
    });

    // أرقام التدريج حول القوس (0 - 5 - 10 - +11)
    ctx.fillStyle = '#334155';
    ctx.font = 'bold 15.5px "Cairo", sans-serif';
    var tickDefs = [
      { r: 0, txt: '1' },
      { r: 1 / 3, txt: '5' },
      { r: 2 / 3, txt: '10' },
      { r: 1, txt: '+11' }
    ];
    tickDefs.forEach(function (tk) {
      var tAngle = -tk.r * Math.PI;
      var tx = gCx + Math.cos(tAngle) * (gRadius + 32);
      var ty = gCy + Math.sin(tAngle) * (gRadius + 32);
      ctx.fillText(tk.txt, tx, ty + 5);
    });

    // تسميات المجالات الثلاثة بوضوح
    ctx.font = 'bold 14px "Cairo", "IBM Plex Sans Arabic", sans-serif';
    ctx.fillStyle = '#15803D';
    ctx.fillText('منخفض (1-5)', gCx + gRadius - 8, gCy + 28);
    ctx.fillStyle = '#EA580C';
    ctx.fillText('متوسط (6-10)', gCx, gCy - gRadius - 32);
    ctx.fillStyle = '#DC2626';
    ctx.fillText('مرتفع (+11)', gCx - gRadius + 8, gCy + 28);

    // مؤشر العداد (الإبرة): 0..5 -> 0..PI/3 | 5..10 -> PI/3..2PI/3 | 10..15+ -> 2PI/3..PI
    var vAvg = Math.max(0, Number(st.dailyAverage || 0));
    var normRatio = 0;
    if (vAvg <= 5) normRatio = (vAvg / 5) * (1 / 3);
    else if (vAvg <= 10) normRatio = (1 / 3) + ((vAvg - 5) / 5) * (1 / 3);
    else normRatio = (2 / 3) + Math.min(1, (vAvg - 10) / 5) * (1 / 3);
    var needleAngle = -normRatio * Math.PI;
    var nLen = gRadius - 18;
    ctx.save();
    ctx.translate(gCx, gCy);
    ctx.rotate(needleAngle);
    ctx.fillStyle = '#1B365D';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(nLen, 0);
    ctx.lineTo(0, 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#1B365D';
    ctx.beginPath();
    ctx.arc(gCx, gCy, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(gCx, gCy, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1B365D';
    ctx.font = 'bold 38px "Cairo", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(st.dailyAverageFmt, gCx, gCy + 58);

    ctx.fillStyle = '#64748B';
    ctx.font = '16px "Cairo", "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText('مرة / يوم', gCx, gCy + 86);

    // 2. بطاقة جدول التكرار اليومي (على اليسار)
    ctx.fillStyle = '#F8FAFC';
    roundRect(ctx, leftBoxX, y, halfW, botH, 14);
    ctx.fill();
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1.2;
    roundRect(ctx, leftBoxX, y, halfW, botH, 14);
    ctx.stroke();

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 20px "Cairo", "IBM Plex Sans Arabic", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('جدول التكرار اليومي', leftBoxX + halfW / 2, y + 40);

    var tblX = leftBoxX + 24;
    var tblW = halfW - 48;
    var tblY = y + 60;
    var maxVisibleRows = Math.min(dRows.length, 9);
    var availH = botH - 80;
    var rH = Math.min(36, Math.floor(availH / (maxVisibleRows + 2)));

    var cW1 = Math.floor(tblW * 0.34); // اليوم
    var cW2 = Math.floor(tblW * 0.33); // التاريخ
    var cW3 = tblW - cW1 - cW2;        // عدد المرات
    var cX1 = tblX + tblW - cW1;
    var cX2 = cX1 - cW2;
    var cX3 = tblX;

    // ترويسة الجدول
    ctx.fillStyle = '#DBEAFE';
    ctx.fillRect(tblX, tblY, tblW, rH);
    ctx.strokeStyle = '#93C5FD';
    ctx.lineWidth = 1;
    ctx.strokeRect(cX1, tblY, cW1, rH);
    ctx.strokeRect(cX2, tblY, cW2, rH);
    ctx.strokeRect(cX3, tblY, cW3, rH);

    ctx.fillStyle = '#1E3A8A';
    ctx.font = 'bold 15px "Cairo", "IBM Plex Sans Arabic", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('اليوم', cX1 + cW1 / 2, tblY + rH - 10);
    ctx.fillText('التاريخ', cX2 + cW2 / 2, tblY + rH - 10);
    ctx.fillText('عدد المرات', cX3 + cW3 / 2, tblY + rH - 10);
    tblY += rH;

    dRows.slice(0, maxVisibleRows).forEach(function (dr, rIdx) {
      ctx.fillStyle = (rIdx % 2 === 0) ? '#FFFFFF' : '#F8FAFC';
      ctx.fillRect(tblX, tblY, tblW, rH);
      ctx.strokeStyle = '#CBD5E1';
      ctx.strokeRect(cX1, tblY, cW1, rH);
      ctx.strokeRect(cX2, tblY, cW2, rH);
      ctx.strokeRect(cX3, tblY, cW3, rH);

      ctx.fillStyle = '#0F172A';
      ctx.font = '15px "Cairo", "IBM Plex Sans Arabic", sans-serif';
      ctx.fillText(dr.day_name, cX1 + cW1 / 2, tblY + rH - 10);
      ctx.fillText(dr.date_short, cX2 + cW2 / 2, tblY + rH - 10);
      ctx.font = 'bold 16px "Cairo", sans-serif';
      ctx.fillText(String(dr.count), cX3 + cW3 / 2, tblY + rH - 10);
      tblY += rH;
    });

    // صف المجموع
    ctx.fillStyle = '#DBEAFE';
    ctx.fillRect(tblX, tblY, tblW, rH);
    ctx.strokeStyle = '#93C5FD';
    ctx.strokeRect(cX2, tblY, cW1 + cW2, rH);
    ctx.strokeRect(cX3, tblY, cW3, rH);

    ctx.fillStyle = '#1E3A8A';
    ctx.font = 'bold 16px "Cairo", "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText('المجموع', cX2 + (cW1 + cW2) / 2, tblY + rH - 10);
    ctx.fillText(String(st.totalOccurrences), cX3 + cW3 / 2, tblY + rH - 10);

    // تذييل الصفحة الأولى
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(M, H - 72);
    ctx.lineTo(W - M, H - 72);
    ctx.stroke();

    ctx.fillStyle = '#64748B';
    ctx.font = '15px "Cairo", "IBM Plex Sans Arabic", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('دار الإحسان – العطف – غرداية', W - M, H - 42);
    ctx.textAlign = 'left';
    ctx.fillText('1 / 2', M, H - 42);
  }

  function drawDottedWritingSection(ctx, W, M, y, numStr, titleTxt, contentTxt, numLines) {
    y = drawSectionPillBanner(ctx, W, M, y, numStr, titleTxt, 310);
    var CW = W - M * 2;
    var lineSpacing = 32;
    var linesText = [];
    if (contentTxt && String(contentTxt).trim()) {
      ctx.font = 'bold 17px "Cairo", "IBM Plex Sans Arabic", sans-serif';
      String(contentTxt).replace(/\r\n/g, '\n').split('\n').forEach(function (rawLn) {
        if (!rawLn.trim()) return;
        var wrapped = wrapLines(ctx, rawLn.trim(), CW - 24, 0);
        linesText = linesText.concat(wrapped);
      });
    }
    if (!linesText.length) {
      linesText = ['—'];
    }

    // صندوق متراص ينتهي مباشرة عند نهاية الكتابة دون ترك فراغات
    var boxH = linesText.length * lineSpacing + 20;
    ctx.fillStyle = '#F8FAFC';
    roundRect(ctx, M, y, CW, boxH, 10);
    ctx.fill();
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1.2;
    roundRect(ctx, M, y, CW, boxH, 10);
    ctx.stroke();

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 17px "Cairo", "IBM Plex Sans Arabic", sans-serif';
    ctx.textAlign = 'right';
    linesText.forEach(function (ln, idx) {
      ctx.fillText(ln, W - M - 14, y + 28 + idx * lineSpacing);
    });

    return y + boxH + 22;
  }

  function drawTargetBehaviorReportPage2(ctx, W, H, repData, logoImg) {
    var M = 68;
    var CW = W - M * 2;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);
    ctx.direction = 'rtl';

    drawReportTopGradientBar(ctx, W);

    var y = 82;
    if (logoImg) {
      ctx.drawImage(logoImg, W - M - 64, 48, 64, 64);
    }

    ctx.fillStyle = '#1B365D';
    ctx.font = 'bold 21px "Cairo", "IBM Plex Sans Arabic", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('تقرير متابعة وقياس السلوك المستهدف – ' + (repData.childName || '........'), W / 2 - 40, y);

    y += 42;
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(M, y);
    ctx.lineTo(W - M, y);
    ctx.stroke();

    y += 30;
    y = drawDottedWritingSection(ctx, W, M, y, '3', 'تحليل السوابق', repData.antecedentsAnalysis, 5);
    y = drawDottedWritingSection(ctx, W, M, y, '4', 'القراءة السلوكية الأولية', repData.initialBehavioralReading, 5);
    y = drawDottedWritingSection(ctx, W, M, y, '5', 'التوصيات والتدخلات المقترحة', repData.recommendationsText, 5);
    y = drawDottedWritingSection(ctx, W, M, y, '6', 'الخلاصة', repData.conclusionText, 4);

    // التوقيعات أسفل الصفحة الثانية
    var sigY = Math.max(y + 45, H - 170);
    ctx.save();
    ctx.strokeStyle = '#64748B';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([4, 4]);
    // خط توقيع المربي المتابع (يمين)
    ctx.beginPath();
    ctx.moveTo(W - M - 380, sigY);
    ctx.lineTo(W - M - 40, sigY);
    ctx.stroke();
    // خط توقيع مدير المركز (يسار)
    ctx.beginPath();
    ctx.moveTo(M + 40, sigY);
    ctx.lineTo(M + 380, sigY);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#475569';
    ctx.font = 'bold 17px "Cairo", "IBM Plex Sans Arabic", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('المربي المتابع' + (repData.educatorName ? (' (' + repData.educatorName + ')') : ''), W - M - 210, sigY + 30);
    ctx.fillText('مدير المركز', M + 210, sigY + 30);

    // تذييل الصفحة الثانية
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(M, H - 72);
    ctx.lineTo(W - M, H - 72);
    ctx.stroke();

    ctx.fillStyle = '#64748B';
    ctx.font = '15px "Cairo", "IBM Plex Sans Arabic", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('دار الإحسان – العطف – غرداية', W - M, H - 42);
    ctx.textAlign = 'left';
    ctx.fillText('2 / 2', M, H - 42);
  }

  function prepareTargetBehaviorReportData(rep, childFullName, secName, kd) {
    var ev = ensureParsedEval(rep);
    var tb = ev.target_behavior_eval || rep.target_behavior_eval || {};
    var tbr = ev.target_behavior_report || rep.target_behavior_report || {};
    var chName = childFullName || (kd && kd.full_name) || ev.child_name || tb.child_name || tbr.child_name || '—';
    var ageVal = tbr.age || tb.age || (kd && kd.dob ? (function (dob) {
      try {
        var bd = new Date(dob); var td = new Date(); var a = td.getFullYear() - bd.getFullYear();
        return a > 0 ? (a + ' سنوات') : '—';
      } catch (e) { return '—'; }
    })(kd.dob) : '—');
    var behTxt = tbr.selected_behaviors_text || tb.selected_behaviors_text || '—';
    var stats = computeTargetBehaviorStats(tb, tbr);

    return {
      childName: chName,
      ageText: ageVal,
      behaviorText: behTxt,
      goalText: tbr.goal_text || 'تهدف هذه المتابعة إلى رصد السلوك المستهدف وقياس معدل تكراره ومدته الزمنية، وتحديد الظروف والمواقف السابقة لحدوثه، من أجل فهم العوامل المرتبطة به وتحديد التدخل التربوي المناسب.',
      antecedentsAnalysis: tbr.antecedents_analysis || '',
      initialBehavioralReading: tbr.initial_reading || '',
      recommendationsText: tbr.recommendations_text || '',
      conclusionText: tbr.conclusion_text || '',
      educatorName: tbr.educator_name || '',
      stats: stats
    };
  }

  async function renderTargetBehaviorReportPage1Canvas(rep, childFullName, secName, kd) {
    if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch (e) {}
    }
    var logoImg = await loadLogoImage();
    var W = 1240, H = 1754;
    var repData = prepareTargetBehaviorReportData(rep, childFullName, secName, kd);
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var ctx = c.getContext('2d');
    drawTargetBehaviorReportPage1(ctx, W, H, repData, logoImg);
    return c;
  }

  async function renderTargetBehaviorReportToPdf(rep, childFullName, secName, kd) {
    if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch (e) {}
    }
    var logoImg = await loadLogoImage();
    var W = 1240, H = 1754;
    var repData = prepareTargetBehaviorReportData(rep, childFullName, secName, kd);

    var c1 = document.createElement('canvas');
    c1.width = W; c1.height = H;
    drawTargetBehaviorReportPage1(c1.getContext('2d'), W, H, repData, logoImg);

    var c2 = document.createElement('canvas');
    c2.width = W; c2.height = H;
    drawTargetBehaviorReportPage2(c2.getContext('2d'), W, H, repData, logoImg);

    var jpg1 = await canvasToJpegBytes(c1, 0.95);
    var jpg2 = await canvasToJpegBytes(c2, 0.95);
    return buildPdfBinary([
      { data: jpg1, width: W, height: H },
      { data: jpg2, width: W, height: H }
    ]);
  }

  /* ══════════════════════════════════════════════════════════════════════════
     حساب ورسم "تقرير دوافع السلوك" (مطابق لملف template_dawafi3_assulouk_v2.pdf)
     ══════════════════════════════════════════════════════════════════════════ */
  var MAS_REPORT_DIMENSIONS = [
    { key: 'sensory', label1: 'المثيرات الحسية', label2: '', items: [1, 5, 9, 13], color: '#1D5B9E' },
    { key: 'attention', label1: 'الانتباه والبحث', label2: 'عن التحفيز', items: [3, 7, 11, 15], color: '#1E7E62' },
    { key: 'tangible', label1: 'التحصيل والإنجاز', label2: '', items: [4, 8, 12, 16], color: '#D97706' },
    { key: 'social', label1: 'التفاعل الاجتماعي', label2: '', items: [3, 11, 15, 7], color: '#2563EB' },
    { key: 'self_control', label1: 'التحكم في الذات', label2: '', items: [1, 5, 13, 14], color: '#7C3AED' },
    { key: 'escape', label1: 'تجنب المجهود', label2: 'والتعب', items: [2, 6, 10, 14], color: '#8B2635' }
  ];

  function computeMasMotivationReportStats(masEval, masReport) {
    var mas = masEval || {};
    var rep = masReport || {};
    var answers = mas.answers || {};
    var manualScores = rep.dimension_scores || {};

    var dimensions = MAS_REPORT_DIMENSIONS.map(function (dim) {
      var rawSum = 0;
      dim.items.forEach(function (qNum) {
        var v = answers[qNum];
        var n = (v !== '' && v != null && !isNaN(parseInt(v, 10))) ? parseInt(v, 10) : 0;
        rawSum += n;
      });
      // تحويل الدرجة من 24 إلى مقياس 0 - 100 تلقائياً
      var autoPct = Math.round((rawSum / 24) * 100);
      var finalScore = (manualScores[dim.key] !== undefined && manualScores[dim.key] !== '' && manualScores[dim.key] !== null && !isNaN(parseFloat(manualScores[dim.key])))
        ? Math.min(100, Math.max(0, Math.round(parseFloat(manualScores[dim.key]))))
        : autoPct;
      return {
        key: dim.key,
        label1: dim.label1,
        label2: dim.label2,
        fullLabel: dim.label1 + (dim.label2 ? (' ' + dim.label2) : ''),
        rawSum: rawSum,
        autoPct: autoPct,
        score: finalScore,
        color: dim.color
      };
    });

    return { dimensions: dimensions };
  }

  function prepareMasBehaviorReportData(rep, childFullName, secName, kd) {
    var ev = ensureParsedEval(rep);
    var mas = ev.mas_eval || rep.mas_eval || ev.mas || {};
    var mbr = ev.mas_behavior_report || rep.mas_behavior_report || {};
    var chName = childFullName || (kd && kd.full_name) || ev.child_name || mas.child_name || mbr.child_name || '—';
    var dobRaw = (kd && kd.dob) || ev.dob || mbr.dob || '';
    var dobDisp = dobRaw ? formatFullDateDDMMYYYY(dobRaw) : '—';
    var ageTxt = mbr.age || (dobRaw ? (function (d) {
      try {
        var bd = new Date(d); var td = new Date(); var a = td.getFullYear() - bd.getFullYear();
        return a > 0 ? (a + ' سنوات') : '—';
      } catch (e) { return '—'; }
    })(dobRaw) : '—');
    var secDisp = secName || (kd && kd.section) || ev.section_name || mbr.section_name || '—';
    var evalDateDisp = formatFullDateDDMMYYYY(mbr.report_date || mas.report_date || ev.report_date || new Date().toISOString().slice(0, 10));
    var evaluatorName = mbr.evaluator_name || mas.informant || 'أ. أمير زكرياء';
    var centerName = mbr.center_name || 'المركز النفسي البيداغوجي دار الإحسان – العطف';
    var stats = computeMasMotivationReportStats(mas, mbr);

    return {
      childName: chName,
      dobText: dobDisp,
      ageText: ageTxt,
      sectionText: secDisp,
      evalDateText: evalDateDisp,
      evaluatorName: evaluatorName,
      centerName: centerName,
      goalText: mbr.goal_text || 'تحديد أنماط ودوافع السلوك لدى الطفل من أجل توجيه التدخل التربوي المناسب.',
      caseAnalysis: mbr.case_analysis || '',
      keyFindings: mbr.key_findings || '',
      recommendationsText: mbr.recommendations_text || '',
      conclusionText: mbr.conclusion_text || '',
      stats: stats
    };
  }

  function drawMasBehaviorReportPage1(ctx, W, H, repData, logoImg) {
    var M = 68;
    var CW = W - M * 2;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);
    ctx.direction = 'rtl';

    drawReportTopGradientBar(ctx, W);

    var y = 66;
    if (logoImg) {
      ctx.drawImage(logoImg, W - M - 115, 42, 115, 115);
    }

    ctx.fillStyle = '#64748B';
    ctx.font = '16px "Cairo", "IBM Plex Sans Arabic", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('المركز النفسي البيداغوجي لرعاية ذوي الاحتياجات الخاصة · دار الإحسان – العطف – غرداية', W / 2 - 30, y);

    y += 46;
    ctx.fillStyle = '#1B365D';
    ctx.font = 'bold 34px "Cairo", "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText('تقرير قياس دوافع السلوك', W / 2 - 30, y);

    y += 34;
    ctx.fillStyle = '#1E7E62';
    ctx.font = 'bold 19px "Cairo", "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText('(استمارة تقييم دوافع السلوك)', W / 2 - 30, y);

    y += 28;
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(M, y);
    ctx.lineTo(W - M, y);
    ctx.stroke();

    y += 20;
    // الصف الأول من بطاقات المعلومات (4 بطاقات: الاسم واللقب | تاريخ الميلاد | العمر الزمني | القسم)
    var gap = 16;
    var cW = (CW - gap * 3) / 4;
    var cH = 74;
    var row1Cards = [
      { label: 'الاسم واللقب', val: repData.childName },
      { label: 'تاريخ الميلاد', val: repData.dobText },
      { label: 'العمر الزمني', val: repData.ageText },
      { label: 'القسم', val: repData.sectionText }
    ];
    var rx = W - M;
    row1Cards.forEach(function (cItem) {
      rx -= cW;
      ctx.fillStyle = '#F1F5F9';
      roundRect(ctx, rx, y, cW, cH, 10);
      ctx.fill();
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 1.2;
      roundRect(ctx, rx, y, cW, cH, 10);
      ctx.stroke();

      ctx.fillStyle = '#64748B';
      ctx.font = '14px "Cairo", "IBM Plex Sans Arabic", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(cItem.label, rx + cW - 14, y + 25);

      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 17px "Cairo", "IBM Plex Sans Arabic", sans-serif';
      var wv = wrapLines(ctx, String(cItem.val || '—'), cW - 24, 1);
      ctx.fillText(wv[0] || '—', rx + cW - 14, y + 54);
      rx -= gap;
    });

    y += cH + 14;
    // الصف الثاني من بطاقات المعلومات (3 بطاقات: تاريخ التقييم | المقيّم | المركز)
    var r2W1 = 300, r2W2 = 340, r2W3 = CW - r2W1 - r2W2 - gap * 2;
    var row2Cards = [
      { label: 'تاريخ التقييم', val: repData.evalDateText, w: r2W1 },
      { label: 'المقيّم', val: repData.evaluatorName, w: r2W2 },
      { label: 'المركز', val: repData.centerName, w: r2W3 }
    ];
    var rx2 = W - M;
    row2Cards.forEach(function (cItem) {
      rx2 -= cItem.w;
      ctx.fillStyle = '#F1F5F9';
      roundRect(ctx, rx2, y, cItem.w, cH, 10);
      ctx.fill();
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 1.2;
      roundRect(ctx, rx2, y, cItem.w, cH, 10);
      ctx.stroke();

      ctx.fillStyle = '#64748B';
      ctx.font = '14px "Cairo", "IBM Plex Sans Arabic", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(cItem.label, rx2 + cItem.w - 14, y + 25);

      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 18px "Cairo", "IBM Plex Sans Arabic", sans-serif';
      var wv = wrapLines(ctx, String(cItem.val || '—'), cItem.w - 24, 1);
      ctx.fillText(wv[0] || '—', rx2 + cItem.w - 14, y + 54);
      rx2 -= gap;
    });

    y += cH + 24;
    // 1. الهدف من التقييم
    y = drawSectionPillBanner(ctx, W, M, y, '1', 'الهدف من التقييم', 255);
    ctx.fillStyle = '#1E293B';
    ctx.font = '19px "Cairo", "IBM Plex Sans Arabic", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(repData.goalText, W - M, y + 12);
    y += 42;

    // 2. النتائج العامة
    y = drawSectionPillBanner(ctx, W, M, y, '2', 'النتائج العامة', 255);

    // صندوق الرسم البياني الكبير (مطابق لصفحة 1 من template_dawafi3_assulouk_v2.pdf)
    var boxH = 710;
    ctx.fillStyle = '#F8FAFC';
    roundRect(ctx, M, y, CW, boxH, 18);
    ctx.fill();
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1.4;
    roundRect(ctx, M, y, CW, boxH, 18);
    ctx.stroke();

    var chartLeft = M + 95;
    var chartRight = W - M - 45;
    var chartTop = y + 60;
    var chartBottom = y + 530;
    var chartW = chartRight - chartLeft;
    var chartH = chartBottom - chartTop;

    ctx.fillStyle = '#64748B';
    ctx.font = '15px "Cairo", "IBM Plex Sans Arabic", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('الدرجة', chartLeft + 18, chartTop - 22);

    var yTicks = [0, 20, 40, 60, 80, 100];
    yTicks.forEach(function (tv) {
      var gy = chartBottom - (tv / 100) * chartH;
      ctx.strokeStyle = tv === 0 ? '#94A3B8' : '#E2E8F0';
      ctx.lineWidth = tv === 0 ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(chartLeft, gy);
      ctx.lineTo(chartRight, gy);
      ctx.stroke();

      ctx.fillStyle = '#475569';
      ctx.font = '16px "Cairo", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(String(tv), chartLeft - 14, gy + 6);
    });

    var dims = repData.stats.dimensions || [];
    var colSlotW = chartW / 6;
    dims.forEach(function (dm, idx) {
      // الترتيب من اليسار لليمين كما في الملف المرفق: المثيرات الحسية -> تجنب المجهود والتعب
      var cx = chartLeft + (idx + 0.5) * colSlotW;
      var barW = 64;
      var barH = Math.max(4, (dm.score / 100) * chartH);
      var barX = cx - barW / 2;
      var barY = chartBottom - barH;

      // رسم العمود البياني
      ctx.fillStyle = dm.color || '#1D5B9E';
      roundRect(ctx, barX, barY, barW, barH, 8);
      ctx.fill();

      // النسبة فوق العمود
      ctx.fillStyle = '#1B365D';
      ctx.font = 'bold 17px "Cairo", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(dm.score + '%', cx, barY - 10);

      // اسم البعد أسفل محور السينات
      ctx.fillStyle = '#1E293B';
      ctx.font = '15.5px "Cairo", "IBM Plex Sans Arabic", sans-serif';
      ctx.fillText(dm.label1, cx, chartBottom + 32);
      if (dm.label2) {
        ctx.fillText(dm.label2, cx, chartBottom + 56);
      }

      // المربع السفلي للدرجة كما في النموذج المرفق
      var scoreBoxW = 114;
      var scoreBoxH = 46;
      var scoreBoxX = cx - scoreBoxW / 2;
      var scoreBoxY = chartBottom + 86;
      ctx.fillStyle = '#FFFFFF';
      roundRect(ctx, scoreBoxX, scoreBoxY, scoreBoxW, scoreBoxH, 8);
      ctx.fill();
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 1.4;
      roundRect(ctx, scoreBoxX, scoreBoxY, scoreBoxW, scoreBoxH, 8);
      ctx.stroke();

      ctx.fillStyle = '#1B365D';
      ctx.font = 'bold 20px "Cairo", sans-serif';
      ctx.fillText(dm.score + ' / 100', cx, scoreBoxY + 30);
    });

    // تذييل الصفحة الأولى
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(M, H - 72);
    ctx.lineTo(W - M, H - 72);
    ctx.stroke();

    ctx.fillStyle = '#64748B';
    ctx.font = '15px "Cairo", "IBM Plex Sans Arabic", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('دار الإحسان – العطف – غرداية', W - M, H - 42);
    ctx.textAlign = 'left';
    ctx.fillText('1 / 2', M, H - 42);
  }

  function drawMasBehaviorReportPage2(ctx, W, H, repData, logoImg) {
    var M = 68;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);
    ctx.direction = 'rtl';

    drawReportTopGradientBar(ctx, W);

    var y = 82;
    if (logoImg) {
      ctx.drawImage(logoImg, W - M - 64, 48, 64, 64);
    }

    ctx.fillStyle = '#1B365D';
    ctx.font = 'bold 21px "Cairo", "IBM Plex Sans Arabic", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('تقرير قياس دوافع السلوك – ' + (repData.childName || '........................................'), M, y);

    y += 42;
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(M, y);
    ctx.lineTo(W - M, y);
    ctx.stroke();

    y += 30;
    y = drawDottedWritingSection(ctx, W, M, y, '3', 'تحليل الحالة', repData.caseAnalysis, 5);
    y = drawDottedWritingSection(ctx, W, M, y, '4', 'أهم النتائج', repData.keyFindings, 5);
    y = drawDottedWritingSection(ctx, W, M, y, '5', 'التوصيات', repData.recommendationsText, 5);
    y = drawDottedWritingSection(ctx, W, M, y, '6', 'الخلاصة', repData.conclusionText, 4);

    // التوقيعات أسفل الصفحة الثانية
    var sigY = Math.max(y + 45, H - 170);
    ctx.save();
    ctx.strokeStyle = '#64748B';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(W - M - 380, sigY);
    ctx.lineTo(W - M - 40, sigY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(M + 40, sigY);
    ctx.lineTo(M + 380, sigY);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#475569';
    ctx.font = 'bold 17px "Cairo", "IBM Plex Sans Arabic", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('المقيّم' + (repData.evaluatorName ? (' (' + repData.evaluatorName + ')') : ''), W - M - 210, sigY + 30);
    ctx.fillText('مدير المركز', M + 210, sigY + 30);

    // تذييل الصفحة الثانية
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(M, H - 72);
    ctx.lineTo(W - M, H - 72);
    ctx.stroke();

    ctx.fillStyle = '#64748B';
    ctx.font = '15px "Cairo", "IBM Plex Sans Arabic", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('دار الإحسان – العطف – غرداية', W - M, H - 42);
    ctx.textAlign = 'left';
    ctx.fillText('2 / 2', M, H - 42);
  }

  async function renderMasBehaviorReportPage1Canvas(rep, childFullName, secName, kd) {
    if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch (e) {}
    }
    var logoImg = await loadLogoImage();
    var W = 1240, H = 1754;
    var repData = prepareMasBehaviorReportData(rep, childFullName, secName, kd);
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    drawMasBehaviorReportPage1(c.getContext('2d'), W, H, repData, logoImg);
    return c;
  }

  async function renderMasBehaviorReportToPdf(rep, childFullName, secName, kd) {
    if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch (e) {}
    }
    var logoImg = await loadLogoImage();
    var W = 1240, H = 1754;
    var repData = prepareMasBehaviorReportData(rep, childFullName, secName, kd);

    var c1 = document.createElement('canvas');
    c1.width = W; c1.height = H;
    drawMasBehaviorReportPage1(c1.getContext('2d'), W, H, repData, logoImg);

    var c2 = document.createElement('canvas');
    c2.width = W; c2.height = H;
    drawMasBehaviorReportPage2(c2.getContext('2d'), W, H, repData, logoImg);

    var jpg1 = await canvasToJpegBytes(c1, 0.95);
    var jpg2 = await canvasToJpegBytes(c2, 0.95);
    return buildPdfBinary([
      { data: jpg1, width: W, height: H },
      { data: jpg2, width: W, height: H }
    ]);
  }

  root.DE_PDF = {
    computeTargetBehaviorStats: computeTargetBehaviorStats,
    prepareTargetBehaviorReportData: prepareTargetBehaviorReportData,
    renderTargetBehaviorReportPage1Canvas: renderTargetBehaviorReportPage1Canvas,
    renderTargetBehaviorReportToPdf: renderTargetBehaviorReportToPdf,
    computeMasMotivationReportStats: computeMasMotivationReportStats,
    prepareMasBehaviorReportData: prepareMasBehaviorReportData,
    renderMasBehaviorReportPage1Canvas: renderMasBehaviorReportPage1Canvas,
    renderMasBehaviorReportToPdf: renderMasBehaviorReportToPdf,
    renderEpilepsyFollowupToPdf: renderEpilepsyFollowupToPdf,
    renderTargetBehaviorToPdf: renderTargetBehaviorToPdf,
    renderMasBehaviorToPdf: renderMasBehaviorToPdf,
    renderBehaviorObservationToPdf: renderBehaviorObservationToPdf,
    buildPdfBinary: buildPdfBinary,
    canvasToJpegBytes: canvasToJpegBytes,
    downloadPdf: downloadPdf,
    computeEvaluationStats: computeEvaluationStats,
    renderQuantitativePageCanvas: renderQuantitativePageCanvas,
    renderWeeklyProgramCanvas: renderWeeklyProgramCanvas,
    renderWeeklyProgramToPdf: renderWeeklyProgramToPdf,
    renderReportToPdf: renderReportToPdf,
    renderEvaluationToPdf: renderEvaluationToPdf,
    renderReinforcersToPdf: renderReinforcersToPdf,
    renderInterviewDiagnosticToPdf: renderInterviewDiagnosticToPdf,
    renderAnnualFinalToPdf: renderAnnualFinalToPdf,
    renderAttendanceToPdf: renderAttendanceToPdf,
    renderChildrenListToPdf: renderChildrenListToPdf
  };

})(typeof window !== 'undefined' ? window : globalThis);
