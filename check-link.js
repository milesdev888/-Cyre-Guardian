(function(){
  var row = document.querySelector('.cta-row');
  if (!row) return;
  var a = document.createElement('a');
  a.href = '/check.html';
  var b = document.createElement('button');
  b.className = 'btn b-ghost';
  b.textContent = 'Check an address';
  a.appendChild(b);
  row.appendChild(a);
})();
