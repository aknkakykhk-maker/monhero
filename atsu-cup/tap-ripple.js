// モンヒロと同じ、タップした位置に波紋が広がるエフェクト
(function(){
  document.addEventListener('pointerdown', function(e){
    var el = document.createElement('span');
    el.className = 'mh-ripple';
    el.style.left = e.clientX + 'px';
    el.style.top = e.clientY + 'px';
    document.body.appendChild(el);
    setTimeout(function(){ el.remove(); }, 650);
  });
})();
