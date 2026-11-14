import { $, $$, escape_HTML } from './util.js';

// popups spawned so far
let spawn_count = 0;

// zalgo combining marks
const ZALGO = ['́', '̂', '̃', '̄', '̅', '̆', '̇', '̈', '̊', '̋', '̧', '̱'];

// popup spawn cadence
const SPAWN_MS = 8000;

// popup window chromes
const CHROMES = ['win95', 'xp', 'mac9', 'prompt', 'bare'];

// ad shapes
const SHAPES = ['plain', 'plain', 'starburst', 'coupon', 'bubble', 'sticker', 'tiny'];

// ad button styles
const BUTTON_STYLES = ['candy', 'link', 'blink', 'plain'];

// desktop icons as [glyph, name]
const ICONS = [['🖥️', 'My Computer'], ['🗑️', 'Recycle Bin'], ['📁', 'My Documents'], ['🌐', 'Internet'], ['📁', 'New Folder (3)'], ['💰', 'FREE_MONEY.exe'], ['⚙️', 'totally_not_a_virus.exe'], ['📄', 'README.txt'], ['💘', 'hot_singles.lnk']];

// layouts that look like windows
const POPUP_LAYOUTS = ['dialog', 'alert', 'error', 'sweepstakes', 'toolbar', 'chat', 'download', 'survey', 'virus', 'wizard', 'balloon', 'plugin', 'permission', 'support', 'crash'];

// layouts that look like ads
const AD_LAYOUTS = ['ad', 'leaderboard', 'skyscraper', 'flashing', 'stickybar', 'interstitial', 'video', 'grid', 'fakedownload'];

// popup text as [title, lines, buttons, art] entries
const TEXTS = [
  ['HOT SINGLES IN YOUR AREA', ['3 singles within 2 miles of you want to chat!!'], ['CHAT NOW'], 'heart'],
  ['Confirm', ['Do you want to leave this page?'], ['Yes', 'No', 'Cancel']],
  ['', ['FREE MONEY'], [], 'cash'],
  ['YOU\'VE WON!!', ['Congratulations! You are today\'s 1,000,000th visitor.', 'Click below to claim your FREE MP3 player.'], ['CLAIM PRIZE'], 'trophy'],
  ['WHY UPGRADE?', ['• 2x faster', '• 50% more colors', '• Now with sound', '• Works with any computer'], ['UPGRADE', 'MAYBE LATER'], 'computer'],
  ['URGENT BUSINESS PROPOSAL', ['Dear Friend, I am a prince with $25,000,000 that must leave the country. I need your bank account number to complete the transfer. You will receive 30%.'], ['HELP THE PRINCE'], 'money'],
  ['FW: FW: FW: FW: read this!!', ['This popup has been around the world 9 times. Send it to 10 people within 10 minutes and something good will happen to you. A man in Ohio ignored it and lost his car keys.'], ['SEND']],
  ['LONELY?', ['Real people are waiting to talk to you RIGHT NOW'], ['START CHATTING'], 'headset'],
  ['PRICE CRASH', ['Was: $49.99', 'Now: $19.99', 'Today only: $0.99'], ['ADD TO CART'], 'cash'],
  ['ONE WEIRD TRICK', ['Local mom discovers one weird trick to lose 30 lbs. Doctors HATE her!!'], ['SEE THE TRICK'], 'shocked'],
  ['NEWSLETTER', ['Enter your email:', '[______________]'], ['SUBMIT']],
  ['*** WARNING ***', ['YOUR COMPUTER IS INFECTED', '47 viruses found. Your files may be deleted.'], ['SCAN NOW', 'IGNORE'], 'warning'],
  ['HURRY', ['OFFER ENDS IN', '00:04:59'], ['BUY NOW']],
  ['MAKE MONEY FAST!!!', ['Earn $5,000 a week from home!! No experience needed!!'], ['START TODAY'], 'money'],
  ['Runtime Error', ['Program: C:\\PROGRAM FILES\\BROWSER.EXE', 'abnormal program termination'], ['OK'], 'warning'],
  ['TERMS OF SERVICE', ['By reading this you agree to the terms of service. The terms of service may change at any time without notice. Continued reading constitutes acceptance of the new terms.'], ['I AGREE', 'DECLINE']],
  ['REAL CUSTOMER', ['"I made $3,000 in my first week!!"', '— Dave, Florida'], ['ME TOO'], 'thumbsup'],
  ['Click here', [], ['HERE']],
  ['Download Complete', ['File: holiday_photos.zip', 'Size: 4.2 MB', 'Time: 2 hours 13 minutes'], ['Open', 'Open Folder', 'Close'], 'computer'],
  ['!!!', ['WOW'], [], 'shocked'],
  ['FREE TABLET!!', ['You have been selected to receive a FREE tablet computer.', 'Just pay $9.95 shipping.'], ['CLAIM'], 'gift'],
  ['PACKAGE DELIVERY', ['We were unable to deliver your package.', 'Click here to reschedule.'], ['RESCHEDULE'], 'gift'],
  ['TAX REFUND', ['You are eligible for a refund of $1,284.00.'], ['CLAIM REFUND'], 'cash'],
  ['TECH SUPPORT', ['Your computer has been locked.', 'Call 1-800-555-0199 immediately.', 'Do not turn off your computer.'], [], 'computer'],
  ['CASINO', ['500 FREE CHIPS'], ['PLAY NOW', 'PLAY LATER'], 'cash'],
  ['LUXURY WATCHES', ['Designer watches 90% OFF', '• Gold', '• Silver', '• Diamond'], ['SHOP']],
  ['DATING', ['Single and looking? Find your soulmate today!!'], ['JOIN FREE'], 'heart'],
  ['INHERITANCE', ['A distant relative has left you $4,500,000.', 'Reply with your full name and address to claim.'], ['CLAIM'], 'money'],
  ['CONGRATULATIONS!!', ['You have been pre-approved for a platinum credit card'], ['ACCEPT', 'DECLINE'], 'trophy'],
  ['LOWER YOUR MORTGAGE', ['Rates as low as 2.9%!!'], ['GET A QUOTE'], 'house'],
  ['GET RICH QUICK', ['I made $10,000 in one week. You can too.'], ['LEARN HOW'], 'money'],
  ['HEALTH ALERT', ['This miracle berry melts belly fat overnight'], ['ORDER NOW'], 'shocked'],
  ['DOWNLOAD MANAGER', ['MORE_RAM.exe'], ['ACCEPT'], 'computer'],
  ['PC CHECKUP', ['Your PC is running SLOW', 'Speed it up by 300%!!'], ['FIX NOW'], 'computer'],
  ['REGISTRY ERRORS', ['1,284 registry errors found'], ['CLEAN', 'CLEAN LATER'], 'warning'],
  ['FREE RINGTONES', ['Text RING to 55555'], ['GET'], 'phone'],
  ['PRIZE NOTIFICATION', ['You may already be a winner!!'], ['FIND OUT'], 'trophy'],
  ['SWEEPSTAKES', ['Enter to win a NEW CAR', 'One entry per household.'], ['ENTER'], 'car'],
  ['WORK FROM HOME', ['Moms are earning $80 an hour from home.', 'See how.'], ['SEE HOW'], 'house'],
  ['PENNY STOCK ALERT', ['This stock is about to EXPLODE', 'Buy before Monday!!'], ['BUY'], 'cash'],
  ['GIFT CARD', ['You\'ve been chosen for a $100 gift card', 'Complete a short survey.'], ['START'], 'gift'],
  ['PSYCHIC', ['Your first 3 minutes are FREE'], ['CALL NOW']],
  ['E-CARD', ['Someone sent you an e-card!!'], ['OPEN'], 'heart'],
  ['FREE SMILEYS', ['Download 10,000 FREE smileys', ':) :D ;) :P'], ['GET SMILEYS'], 'smiley'],
  ['SECURITY ALERT', ['SPYWARE DETECTED'], ['REMOVE NOW'], 'warning'],
  ['FREE SCREENSAVERS', ['Aquariums, fireworks, and more'], ['BROWSE'], 'computer'],
  ['HIT COUNTER', ['Get a FREE hit counter for your homepage'], ['COUNT ME IN']],
  ['GUESTBOOK', ['Please sign my guestbook!!'], ['SIGN']],
  ['UNDER CONSTRUCTION', ['This page is under construction'], [], 'warning'],
  ['BEST VIEWED IN', ['This site is best viewed at 800x600'], ['OK'], 'computer'],
  ['MIDI PLAYER', ['Now playing: hold_music.mid'], ['PLAY', 'STOP']],
  ['CD-ROM', ['Please insert Disc 2 of 4'], ['OK', 'Cancel'], 'computer'],
  ['AWAY MESSAGE', ['brb'], []],
  ['DIAL-UP', ['Connecting at 28.8 kbps...'], ['Cancel'], 'computer'],
  ['PUNCH THE MONKEY', ['Punch the monkey and WIN $20!!'], ['PUNCH']],
  ['RAM DOUBLER', ['Double your RAM instantly!!'], ['DOUBLE IT'], 'computer'],
  ['FREE EMAIL', ['Get a FREE email address', '10 MB of storage'], ['SIGN UP']],
  ['COOKIE NOTICE', ['This site uses cookies'], ['ACCEPT']],
  ['BROWSER UPDATE', ['A new version of your browser is available'], ['UPDATE', 'REMIND ME LATER'], 'warning'],
  ['MAKE THIS YOUR HOMEPAGE', ['Set this site as your homepage for FREE!'], ['YES', 'NO'], 'house'],
  ['TOOLBAR', ['Install the SuperSearch Bar'], ['INSTALL']],
  ['CUSTOM CURSORS', ['500 animated cursors'], ['BROWSE']],
  ['WEB HOSTING', ['Your OWN website for $4.99 a month'], ['ORDER'], 'computer'],
  ['TRAVEL DEAL', ['Fly anywhere for $99'], ['BOOK']],
  ['WEBCAM', ['See the world LIVE'], ['WATCH'], 'computer'],
  ['VIDEO PLAYER', ['This video requires a plugin'], ['INSTALL']],
  ['POP-UP BLOCKER', ['Tired of pop-ups??'], ['DOWNLOAD'], 'warning'],
  ['FREE CREDIT SCORE', ['Check your credit score for FREE'], ['CHECK'], 'cash'],
  ['GRANT MONEY', ['You may be eligible for government grant money'], ['FIND OUT'], 'money'],
  ['PHONE CARDS', ['Call anywhere for 3¢ a minute'], ['BUY'], 'phone'],
  ['CHAT ROOMS', ['1,523 people are chatting NOW'], ['ENTER'], 'headset'],
  ['MP3', ['Download any song in seconds'], ['DOWNLOAD']],
  ['BOOKMARK', ['Add us to your favorites'], ['OK']],
  ['PRINTER INK', ['Ink 80% OFF'], ['SHOP'], 'computer'],
  ['FREE TRIAL', ['Start your FREE 30-day trial', 'Cancel anytime.'], ['START'], 'gift'],
  ['LOTTERY', ['Your numbers have been selected', 'Claim before midnight'], ['CLAIM'], 'trophy'],
  ['COUPONS', ['Print FREE coupons'], ['PRINT'], 'cash'],
  ['FONT PACK', ['2,000 FREE fonts'], ['GET FONTS']],
  ['ANTIVIRUS', ['Your subscription has expired'], ['RENEW'], 'warning'],
  ['FREE PHONE', ['Get a FREE cell phone', 'With 2-year contract'], ['ORDER'], 'phone'],
  ['DRIVER UPDATE', ['Your drivers are out of date'], ['UPDATE'], 'computer'],
  ['SPEED TEST', ['Your connection is 56 kbps'], ['UPGRADE'], 'computer'],
  ['HOROSCOPE', ['Your daily horoscope is ready'], ['READ']],
  ['FREE GAMES', ['100s of FREE games'], ['PLAY'], 'smiley'],
  ['TRIVIA', ['Answer 3 questions to WIN', 'Question 1: What color is the sky?'], ['Blue', 'Red', 'Green'], 'trophy'],
  ['KARAOKE', ['Sing along to 1,000s of songs'], ['SING']],
  ['CLASSIFIEDS', ['Post your ad for FREE'], ['POST']],
  ['EXTENDED WARRANTY', ['Your vehicle warranty is about to expire'], ['CALL NOW'], 'car'],
  ['FILE TRANSFER', ['free_screensavers_ALL.zip'], ['ACCEPT', 'REJECT'], 'computer'],
  ['FATAL EXCEPTION', ['A fatal exception 0E has occurred at 0028:C0011E36', 'Press any key to continue.'], []],
  ['KEYBOARD ERROR', ['Keyboard not found', 'Press F1 to continue'], ['F1']],
  ['LOW DISK SPACE', ['You are running out of space on drive A:'], ['OK']],
  ['NEW HARDWARE FOUND', ['Your computer has detected 1 cup holder'], ['OK'], 'computer'],
  ['HAMSTER DANCE', ['Your hamster is ready'], ['DANCE']],
  ['SINGLE MOMS', ['Single moms in your area want to meet you'], ['MEET THEM'], 'heart'],
  ['BID NOW', ['Online auction ends in 2 minutes', 'Current bid: $1'], ['BID'], 'gift'],
  ['SECURITY ALERT', ['Unusual sign-in attempt detected.', 'Location: unknown'], ['THAT WAS ME', 'SECURE ACCOUNT'], 'warning'],
  ['ACT NOW!!', ['Only 2 left in stock!!'], ['BUY NOW'], 'gift'],
  ['FREE VACATION', ['You and a guest have won a 3-day cruise!!'], ['CLAIM']],
  ['SURVEY', ['How would you rate your visit today?'], ['GOOD', 'OK', 'BAD'], 'smiley'],
  ['ERROR 0x00000000', ['Nothing is wrong.', 'Nothing is wrong. Nothing is wrong. Nothing is wrong.'], ['CONTINUE']],
  ['Message', ['Are you still there?'], ['Yes']],
  ['Notice', ['Please stay on this page.'], ['OK']],
  ['System', ['Do not scroll down.'], ['OK']],
  ['Connection', ['Someone else is viewing this page.'], ['OK']],
  ['Message', ['Sorry.'], ['OK']],
  ['Notice', ['This window cannot be closed.'], ['OK']],
  ['System', ['Thank you for staying.'], ['OK']],
  ['CELEBRITY', ['You won\'t believe what this child star looks like now'], ['SEE PHOTOS'], 'portrait'],
  ['BE YOUR OWN BOSS', ['Join my team and earn passive income from home!!', '• No experience', '• No boss', '• Unlimited potential'], ['JOIN MY TEAM'], 'money'],
  ['MISSED CALL', ['You have 1 new voicemail'], ['LISTEN'], 'phone'],
  ['CONGRATULATIONS, INTERNET USER!', ['You have been selected to take part in our annual visitor survey.'], ['CONTINUE'], 'trophy'],
  ['LOCAL HACKERS HATE HIM', ['Local man finds one simple way to get FREE internet'], ['READ MORE'], 'thumbsup'],
  ['ONLINE PHARMACY', ['No prescription needed!!', 'Discreet shipping worldwide.'], ['ORDER NOW']],
  ['MEDIA PLAYER', ['Your media player is out of date', 'Update now to continue watching.'], ['UPDATE', 'LATER'], 'warning'],
  ['NOTIFICATIONS', ['This site wants to show notifications'], ['Allow', 'Block']],
  ['LOCATION', ['This site wants to know your location'], ['Allow', 'Block']],
  ['SUPPORT', ['Hi! I\'m Ashley. How can I help you today?'], ['REPLY'], 'headset'],
  ['YOU WON\'T BELIEVE #7', ['10 things your doctor won\'t tell you'], ['SEE THE LIST'], 'shocked'],
  ['SHOCKING', ['Scientists baffled by this local man\'s electric bill'], ['SEE WHY'], 'shocked'],
];

// random element of a list
const pick = (list) => list[Math.floor(Math.random() * list.length)];

// mojibake characters
const MOJIBAKE = { "'": 'â€™', '"': 'â€œ', '—': 'â€”', '•': 'â€¢', '¢': 'Â¢' };
const mojibake = (s) => s.replace(/['"—•¢]/g, (c) => MOJIBAKE[c]);

// text malfunctions for glitched popups
const GLITCHES = [

  // stuck loop on the first words
  ([title, lines, buttons, art]) => {
    const words = (lines[0] || title).split(' ').slice(0, 3).join(' ') + ' ';
    return [title, [words.repeat(12).slice(0, 70), ...lines.slice(1)], buttons, art];
  },

  // wrong encoding
  (text) => text.map((field) => Array.isArray(field) ? field.map(mojibake) : mojibake(field ?? '')),

  // unfilled template fields
  ([title, lines, buttons, art]) => ['{{title}}', ['undefined', ...lines.slice(1)], buttons, art],

  // lines cut off mid-word
  ([title, lines, buttons, art]) => [title, lines.map((line) => line.slice(0, Math.ceil(line.length * 0.6))), buttons, art],
];

// escaped html pieces of one text
function pieces([title, lines, buttons, art]) {

  // own art in most popups
  const show_art = art && Math.random() < 0.6;
  return {
    title: escape_HTML(title),
    lines: lines.map((line) => `<div class="pop-line">${escape_HTML(line)}</div>`).join(''),
    buttons: buttons.map((label) => `<a class="pop-cta" href="#">${escape_HTML(label)}</a>`).join(''),
    art: show_art ?`<img class="pop-img" src="assets/img/popup/${art}.png" alt="">` : '',
    options: buttons.map((label) => `<label class="pop-survey-opt"><input type="radio" name="q${Math.random()}"> ${escape_HTML(label)}</label>`).join(''),
    plain: lines.map(escape_HTML).join('\n'),
  };
}

// four clickbait tiles from random texts with art
function grid_tiles() {

  const with_art = TEXTS.filter((text) => text[3]);
  return [1, 2, 3, 4].map(() => {
    const text = pick(with_art);
    return `<div class="pop-grid-tile"><img src="assets/img/popup/${text[3]}.png" alt=""><span>${escape_HTML(text[1][0] || text[0])}</span></div>`;
  }).join('');
}

// body html for each layout
const LAYOUTS = {
  dialog: (p) => `<div class="pop-banner">★★★ ${p.title} ★★★</div>${p.art}${p.lines}${p.buttons}`,
  alert: (p) => `<div class="pop-icon">⚠</div><div class="pop-banner">${p.title}</div>${p.lines}${p.buttons}`,
  error: (p) => `<div class="pop-icon pop-icon-error">✕</div><div class="pop-error-line">${p.lines}</div>${p.buttons}`,
  sweepstakes: (p) => `<div class="pop-banner">🎉 ${p.title} 🎉</div>${p.art}${p.lines}<div class="pop-confetti">✦ ★ ✦ ★ ✦ ★ ✦ ★ ✦</div>${p.buttons}`,
  toolbar: (p) => `<div class="pop-tb-icon">⚙</div><div class="pop-tb-text"><strong>${p.title}</strong>${p.lines}</div>${p.buttons}`,
  chat: (p) => `<div class="pop-chat-tabs"><span class="active">CHAT</span><span>BUDDIES</span><span>AWAY</span></div><div class="pop-chat-log"><div class="pop-chat-msg pop-chat-you">you: hi??</div><div class="pop-chat-msg pop-chat-them"><strong>${p.title}:</strong>${p.lines}</div></div>${p.buttons}`,
  download: (p) => `<div class="pop-dl-filename">${p.title}</div><div class="pop-dl-bar"><div class="pop-dl-fill" style="width:${10 + Math.floor(Math.random() * 89)}%"></div></div>${p.lines}${p.buttons}`,
  survey: (p) => `<div class="pop-survey-q">${p.title}</div>${p.lines}${p.options}<a class="pop-cta" href="#">SUBMIT</a>`,
  virus: (p) => `<pre class="pop-virus-screen">C:\\&gt; SCAN.EXE\n*** ${p.title} ***\n\n${p.plain}\n\n&gt; _</pre>${p.buttons}`,
  wizard: (p) => `<div class="pop-wiz-step">Step 1 of ${2 + Math.floor(Math.random() * 9)}</div><div class="pop-wiz-banner">${p.title}</div><div class="pop-wiz-text">${p.lines}</div>${p.buttons}`,
  balloon: (p) => `<div class="pop-balloon-icon">🔔</div><div class="pop-balloon-text"><strong>${p.title}</strong>${p.lines}</div>${p.buttons}`,
  plugin: (p) => `<div class="pop-plugin-bar">🧩 ${p.title}</div>${p.lines}${p.buttons}`,
  permission: (p) => `<div class="pop-perm-site">www.rikabgambhir.com wants to</div><div class="pop-perm-ask">🔔 ${p.title}</div>${p.lines}${p.buttons}`,
  support: (p) => `<div class="pop-support-head">● Live Support</div>${p.art}<div class="pop-support-bubble">${p.lines}</div><div class="pop-support-input">Type a message...</div>${p.buttons}`,
  crash: (p) => `<pre class="pop-crash-text">A problem has been detected and your browser has been shut down.\n\n${p.title}\n\n${p.plain}\n\nPress any key to continue _</pre>`,
  ad: (p) => `<div class="pop-banner">🔥 ${p.title} 🔥</div>${p.art}${p.lines}${p.buttons}`,
  leaderboard: (p) => `${p.art}<div class="pop-lb-text"><div class="pop-lb-title">${p.title}</div>${p.lines}</div>${p.buttons}`,
  skyscraper: (p) => `<div class="pop-sky-title">${p.title}</div>${p.art}${p.lines}${p.buttons}`,
  flashing: (p) => `<div class="pop-flash-title">${p.title}</div>${p.lines}${p.buttons}`,
  stickybar: (p) => `<span class="pop-sticky-title">${p.title}</span>${p.lines}${p.buttons}`,
  interstitial: (p) => `<div class="pop-inter-label">Advertisement</div><div class="pop-inter-skip">Skip ad in 5</div>${p.art}<div class="pop-inter-title">${p.title}</div>${p.lines}${p.buttons}`,
  video: (p) => `<div class="pop-video-screen"><div class="pop-video-play">▶</div></div><div class="pop-video-bar">0:00 / 3:47</div><div class="pop-video-title">${p.title}</div>`,
  grid: () => `<div class="pop-grid-head">Sponsored Stories</div><div class="pop-grid">${grid_tiles()}</div>`,
  fakedownload: (p) => `<div class="pop-fake-label">Advertisement</div><a class="pop-fake-dl" href="#">⬇ DOWNLOAD</a><div class="pop-fake-sub">${p.title}</div>`,
};

// random colors, fonts, and rare tiled backgrounds
const LOOKS = {
  colors: [['#c0c0c0', '#000'], ['#ffff66', '#c00'], ['#ff99cc', '#000080'], ['#99ffff', '#000'], ['#000080', '#ffff00'], ['#fff', '#00f'], ['#33cc33', '#000'], ['#000', '#33ff33']],
  fonts: ['"Comic Sans MS", cursive', '"Times New Roman", serif', '"Courier New", monospace', 'Impact, sans-serif', 'Arial, sans-serif', 'Verdana, sans-serif'],
  backgrounds: ['bg_stars', 'bg_clouds', 'bg_marble', 'bg_flames', 'bg_water', 'bg_metal', 'bg_money', 'bg_galaxy', 'bg_brick', 'bg_glitter'],
};

// random look for an ad or a chromeless popup
function apply_look(el) {

  const [background, color] = pick(LOOKS.colors);
  el.style.background = background;
  el.style.color = color;
  el.style.fontFamily = pick(LOOKS.fonts);
  if (Math.random() < 1 / 8) el.style.backgroundImage = `url(assets/img/popup/${pick(LOOKS.backgrounds)}.png)`;
}

// position, stacking, close button, and raise-on-click for one popup
function place(el, left, top, task) {

  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
  el.style.zIndex = String(1000 + spawn_count++);
  el.querySelectorAll('.pop-close').forEach((x) => x.addEventListener('click', () => {
    el.remove();
    task?.remove();
  }));
  el.addEventListener('mousedown', () => { el.style.zIndex = String(1000 + spawn_count++); });
  document.body.appendChild(el);
}

function spawn_popup() {

  // random text with a rare glitch and a rare crash
  let text = pick(TEXTS);
  const glitch = Math.random() < 0.2 ? Math.floor(Math.random() * (GLITCHES.length + 1)) : -1;
  if (glitch >= 0 && glitch < GLITCHES.length) text = GLITCHES[glitch](text);
  const is_ad = Math.random() < 0.25;
  let type = pick(is_ad ? AD_LAYOUTS : POPUP_LAYOUTS);
  if (type === 'crash' && Math.random() < 0.8) type = 'dialog';
  const body = `<div class="pop-body">${LAYOUTS[type](pieces(text))}</div>`;
  const close = '<button type="button" class="pop-close" aria-label="close">×</button>';
  const el = document.createElement('div');
  const page = $('.browser-page').getBoundingClientRect();
  let left;
  let top;
  let task;

  // ads over the page with a shape and a button style
  if (is_ad) {
    el.className = `pop pop-${type} ad shape-${pick(SHAPES)} btn-${pick(BUTTON_STYLES)}`;
    el.innerHTML = `${close}<span class="ad-label">Advertisement</span>${body}`;
    apply_look(el);
    left = page.left + Math.random() * Math.max(0, page.width - 340);
    top = page.top + Math.random() * Math.max(0, page.height - 280);
  }

  // popups on the desktop with a chrome and a taskbar button
  else {
    const chrome = type === 'crash' ? 'bare' : pick(CHROMES);
    const title = escape_HTML(text[0] || 'Message');
    el.className = `pop pop-${type} chrome-${chrome}`;
    el.innerHTML = chrome === 'bare' || chrome === 'prompt' ? `${close}${body}` : `<div class="win-titlebar"><span class="win-title">${title}</span><span class="win-buttons"><b>_</b>${close}</span></div>${body}`;
    if (chrome === 'bare' || chrome === 'prompt') apply_look(el);
    left = Math.random() * Math.max(0, innerWidth - 380);
    top = Math.random() * Math.max(0, innerHeight - 360);
    if (chrome === 'prompt') {
      left = page.left + page.width / 2 - 160;
      top = page.top;
    }
    task = document.createElement('b');
    task.className = 'taskbar-task';
    task.innerHTML = title;
    $('.taskbar-tasks').appendChild(task);
  }

  // double spawn twin
  if (glitch === GLITCHES.length) place(el.cloneNode(true), left + 6, top + 6);
  place(el, left, top, task);
}

// sketchy domain endings for sponsored links
const TLDS = ['.biz', '.info', '.net', '.cc', '.ws'];

// fake url from a text's title
const url_of = (text) => 'www.' + text[0].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + pick(TLDS);

// own art in most page ads
const ad_art = (text) => text[3] && Math.random() < 0.6 ? `<img src="/assets/img/popup/${text[3]}.png" alt="">` : '';

// advertisement label and fake ad-choices corner
const CORNER = '<span class="inpage-label">Advertisement</span><span class="inpage-x">▷ ×</span>';

// random text with a title and a line
const ad_text = () => pick(TEXTS.filter((text) => text[0] && text[1].length));

// top banner
function inpage_banner() {

  const text = ad_text();
  return `<div class="inpage-ad inpage-banner">${CORNER}${ad_art(text)}<div style="flex:1"><b>${escape_HTML(text[0])}!!!</b>${escape_HTML(text[1][0])}</div><a class="inpage-cta" href="#">${escape_HTML(text[2][0] || 'CLICK HERE')}</a></div>`;
}

// side skyscraper
function inpage_sky() {

  const text = ad_text();
  return `<div class="inpage-ad inpage-sky">${CORNER}<b>${escape_HTML(text[0])}</b>${ad_art(text)}<p>${escape_HTML(text[1][0])}</p><a class="inpage-cta" href="#">${escape_HTML(text[2][0] || 'CLICK HERE')}</a></div>`;
}

// sponsored links or a box ad between sections
function inpage_between() {

  if (Math.random() < 0.5) {
    const links = [1, 2, 3].map(() => {
      const text = ad_text();
      return `<a href="#">${escape_HTML(text[0][0] + text[0].slice(1).toLowerCase())} - ${escape_HTML(text[2][0] || 'Click Here')}!</a><div class="desc">${escape_HTML(text[1][0])}</div><div class="url">${url_of(text)}</div>`;
    }).join('');
    return `<div class="inpage-ad inpage-links">${CORNER}<div class="head">Sponsored Links</div>${links}</div>`;
  }
  const text = ad_text();
  return `<div class="inpage-ad inpage-box">${CORNER}<b>${escape_HTML(text[0])}</b>${ad_art(text)}<div>${escape_HTML(text[1][0])}</div><a class="inpage-cta" href="#">${escape_HTML(text[2][0] || 'CLICK HERE')}</a></div>`;
}

// banner, skyscraper, and ads after sections and subsections of the site in the browser window
function build_inpage_ads(doc) {

  // ad stylesheet, banner on top, and skyscraper on the right
  doc.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="/css/inpage-ads.css">');
  doc.body.insertAdjacentHTML('afterbegin', inpage_banner());
  doc.body.insertAdjacentHTML('beforeend', inpage_sky());

  // ad spots after sections and subsections
  const blocks = [...doc.querySelectorAll('main > section, .talk-cat-block, #stats, .card:nth-of-type(4n)')];
  const spots = blocks.length ? blocks : [...doc.querySelectorAll('body > p')].filter((p, i) => i % 6 === 5);
  for (const spot of spots) if (Math.random() < 0.6) spot.insertAdjacentHTML('afterend', inpage_between());
}

// when popup mode began
const started_at = Date.now();

// lines for the swap glitch
const SPAM_LINES = TEXTS.map((text) => text[1][0] || text[0]).filter(Boolean);

// jitter for the spasm glitch
const GLITCH_CSS = '.glitch-spasm { animation: glitch-spasm 0.08s steps(2) 5; } @keyframes glitch-spasm { 0% { transform: translate(-3px, 1px) skewX(4deg); } 50% { transform: translate(4px, -2px); } 100% { transform: none; } }';

// one glitch on one text element of the site in the browser window
function page_glitch(doc) {

  // a leaf text element with at least 5 characters
  const targets = [...doc.querySelectorAll('h1, h2, h3, p, a, li, .card-title, .talk-title')].filter((el) => el.textContent.trim().length > 4 && !el.children.length);
  if (!targets.length) return;
  const el = pick(targets);
  const original = el.textContent;
  const kind = pick(['missing', 'mojibake', 'zalgo', 'spasm', 'swap']);

  // spasm glitch
  if (kind === 'spasm') {
    el.classList.add('glitch-spasm');
    setTimeout(() => el.classList.remove('glitch-spasm'), 500);
    return;
  }

  // text glitches
  if (kind === 'missing') el.textContent = original.replace(/[a-z]/g, (c) => Math.random() < 0.15 ? pick(['□', '�']) : c);
  if (kind === 'mojibake') el.textContent = original.replace(/[aeo'"]/g, (c) => ({ a: 'Ã¡', e: 'Ã©', o: 'Ã¶', "'": 'â€™', '"': 'â€œ' })[c]);
  if (kind === 'zalgo') el.textContent = [...original].map((c) => Math.random() < 0.3 ? c + pick(ZALGO) : c).join('');
  if (kind === 'swap') el.textContent = pick(SPAM_LINES);

  // revert unless sticky
  const sticky = Math.random() < Math.min(0.3, (Date.now() - started_at) / 1000000);
  if (!sticky) setTimeout(() => { el.textContent = original; }, 600 + Math.random() * 900);
}

// reload as the modern page
const exit_on_escape = (e) => { if (e.key === 'Escape') top.location.search = '?mode=0'; };

// desktop with icons, a browser window showing the site in mode inner_mode, and a taskbar
function build_desktop(inner_mode) {

  // icons, browser window, and taskbar
  const icons = ICONS.map(([glyph, name]) => `<div class="desktop-icon"><span class="desktop-icon-glyph">${glyph}</span><span class="desktop-icon-name">${name}</span></div>`).join('');
  const clock = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  document.body.insertAdjacentHTML('beforeend', `
    <div class="desktop">
      <div class="desktop-icons">${icons}</div>
      <div class="browser">
        <div class="win-titlebar"><span class="win-title">Rikab Gambhir - Web Browser</span><span class="win-buttons"><b>_</b><b>□</b><b>×</b></span></div>
        <div class="browser-menu">File&nbsp;&nbsp; Edit&nbsp;&nbsp; View&nbsp;&nbsp; Favorites&nbsp;&nbsp; Tools&nbsp;&nbsp; Help</div>
        <div class="browser-toolbar"><b>◀ Back</b><b>▶</b><b>✕ Stop</b><b>⟳ Refresh</b><b>⌂ Home</b></div>
        <div class="browser-address">Address <span class="browser-url">http://www.rikabgambhir.com/?mode=${inner_mode}</span><b>Go</b></div>
        <div class="browser-page"><iframe src="?mode=${inner_mode}" title="Rikab Gambhir"></iframe></div>
        <div class="browser-status">Done</div>
      </div>
      <div class="taskbar"><b class="taskbar-start">⊞ Start</b><div class="taskbar-tasks"></div><div class="taskbar-tray">Esc to exit · ${clock}</div></div>
    </div>`);

  // click selects an icon and double-click opens a popup
  for (const icon of $$('.desktop-icon')) {
    icon.addEventListener('click', () => {
      $$('.desktop-icon').forEach((other) => other.classList.remove('selected'));
      icon.classList.add('selected');
    });
    icon.addEventListener('dblclick', spawn_popup);
  }

  // ads, glitches, and Esc inside the site on each load
  const frame = $('.browser-page iframe');
  let glitch_timer;
  frame.addEventListener('load', () => {
    const doc = frame.contentDocument;
    clearInterval(glitch_timer);
    if (!doc?.head) return;
    doc.head.insertAdjacentHTML('beforeend', `<style>${GLITCH_CSS}</style>`);
    build_inpage_ads(doc);
    glitch_timer = setInterval(() => page_glitch(doc), 1800);
    doc.addEventListener('keydown', exit_on_escape);
  });
}

export function install_popups(inner_mode) {

  // desktop and the first popups
  build_desktop(inner_mode);
  for (let i = 0; i < 3; i++) spawn_popup();
  setInterval(spawn_popup, SPAWN_MS);

  // Esc leaves for the modern page
  document.addEventListener('keydown', exit_on_escape);
}
