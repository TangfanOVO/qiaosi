/* ── 桌宠：透卡和流麻牌上的小家伙是一个颜文字 ──
   点它换一个表情；它“现在”的样子跟着场景走（看书时戴眼镜、听歌时摇头、夜里打盹），以后可以由后端推它在做什么来决定。
   每个表情有两三帧，隔一会儿换一帧（眨眼、左右看、冒泡泡……），画在一张 240×240 的透明小画布上，再贴到卡上 */
const PET = (() => {
  const FACES = {
    '过日子': [['( ˘ω˘ )', 2600], ['( -ω- )', 160]],
    '东张西望': [['(・ω・ )', 900], ['( ・ω・)', 900]],
    '戴眼镜看书': [['( ・ω・)φ', 1400], ['( -ω-)φ', 160], ['( ・ω・)φ', 1200]],
    '在敲键盘': [['(っ・ω・)っ', 220], ['(っ・ω・)っ ﾟ', 220]],
    '想事情': [['(￣～￣ )', 1200], ['(￣～￣;)', 900]],
    '戴耳机摇': [['♪( ´ε` )', 520], ['( ´ε` )♪', 520]],
    '打盹': [['( ˘ω˘ )ｚ', 700], ['( ˘ω˘ )ｚｚ', 700], ['( ˘ω˘ )ｚｚｚ', 900]],
    '高兴': [['(≧▽≦)', 700], ['ヽ(≧▽≦)ﾉ', 700]],
    '害羞': [['(*/ω＼*)', 1400], ['(*/ω＼)', 500]],
    '吐泡泡': [['( ・o・)ﾟ', 600], ['( ・o・)ﾟo', 600], ['( ・o・)ﾟoO', 900]],
    '打哈欠': [['( ´o｀)', 900], ['( ´-｀)', 900]],
    '端咖啡': [['( ˘▽˘)っ旦', 1600], ['( ˘▽˘)っ旦~', 900]],
    '灵光一闪': [['(・∀・)!', 600], ['(ﾟ∀ﾟ)!!', 600]],
    '蹦两下': [['ヽ(・∀・)ﾉ', 260], ['ヽ(・∀・)ノ', 260]],
    '盯着你': [['( ¬_¬)', 1800], ['(¬_¬ )', 1200]],
    '睡了': [['( ˘ω˘ ) ｚｚｚ', 2000]]
  };
  const PICK = ['过日子', '高兴', '害羞', '戴眼镜看书', '在敲键盘', '想事情', '戴耳机摇', '端咖啡', '灵光一闪', '东张西望', '打盹', '蹦两下', '盯着你', '吐泡泡'];
  const LABEL = {'过日子': '闲着', '东张西望': '在等你', '戴眼镜看书': '在看书', '在敲键盘': '在调用工具', '想事情': '在想事情', '戴耳机摇': '在听歌', '打盹': '眯一会儿', '高兴': '开心', '害羞': '害羞', '吐泡泡': '发呆', '打哈欠': '有点困', '端咖啡': '喝一口', '灵光一闪': '想到了', '蹦两下': '蹦两下', '盯着你': '看着你呢', '睡了': '睡了'};
  const FONT = '"Hiragino Sans","PingFang SC","Noto Sans CJK SC","Noto Sans CJK JP","Yu Gothic","Microsoft YaHei",sans-serif';
  const cv = document.createElement('canvas'); cv.width = cv.height = 240; cv._k = 1; cv._smooth = true;
  const g = cv.getContext('2d');
  const paint = (txt, hop) => {   // 一帧：暖橘色的字，外面一圈白边（印在透卡上、切成流麻挂件都看得清），整体往下放一点（“脚”在 222/240 那条线上）
    g.clearRect(0, 0, 240, 240);
    let fs = 64; g.font = `700 ${fs}px ${FONT}`; const w = g.measureText(txt).width; if (w > 212){ fs = Math.floor(fs * 212 / w); g.font = `700 ${fs}px ${FONT}`; }
    const y = 222 - fs * .55 - hop;
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.lineWidth = Math.max(6, fs * .16); g.strokeStyle = 'rgba(255,253,248,.96)'; g.strokeText(txt, 120, y);
    g.fillStyle = '#c4613f'; g.fillText(txt, 120, y);
  };
  let cur = null, fi = 0, acc = 0, manual = null, base = null, hopT = 0, hopAcc = 0;
  const show = name => { if (!FACES[name] || name === cur) return; cur = name; fi = 0; acc = 0; paint(FACES[name][0][0], 0); drawPet(cv); };
  const ctx = () => focusKey === 'book' ? '戴眼镜看书' : focusKey === 'music' ? '戴耳机摇' : focusKey === 'letter' ? '害羞' : todDark() > .8 ? '打盹' : '过日子';
  return {
    label: () => LABEL[cur] || '',
    next(){ const k = PICK.indexOf(cur); manual = PICK[(k + 1) % PICK.length]; show(manual); },
    tick(dt){
      const b = ctx(); if (b !== base){ base = b; manual = null; show(b); }
      if (!cur) return;
      const F = FACES[cur]; acc += Math.min(dt, .1) * 1000;
      if (cur === '蹦两下'){ hopT += dt; hopAcc += dt; if (hopAcc > .07){ hopAcc = 0; paint(F[fi][0], Math.abs(Math.sin(hopT * 7)) * 16); drawPet(cv); } }   // 蹦：一上一下（一秒重画十几次就够了）
      if (acc >= F[fi][1]){ acc = 0; fi = (fi + 1) % F.length; if (cur !== '蹦两下'){ paint(F[fi][0], 0); drawPet(cv); } }
    }
  };
})();


