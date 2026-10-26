// נטען לפני הציור הראשון כדי למנוע הבהוב: מצב בהיר/כהה לפי העדפה שמורה או לפי המערכת.
(function () {
  var t = null;
  try { t = localStorage.getItem('miflaga:theme'); } catch (e) { /* פרטי */ }
  if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t);
})();
