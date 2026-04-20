⏺ 두 파일의 구조를 먼저 파악하겠습니다.

  Read 2 files (ctrl+o to expand)

⏺ 구조 파악 완료. 이제 스크립트 파일의 slide-num 패턴과 슬라이드 파일의 SEC
  섹션 크기를 확인하겠습니다.

  Searched for 1 pattern, read 1 file (ctrl+o to expand)     
                                                   
⏺ 스크립트 합계가 81개(=뷰어 총 슬라이드)로 일치합니다. 글로벌 순서 인덱스로
  직접 매핑하는 방식을 쓰겠습니다. 스크립트 파일 끝부분을 확인합니다.
                                                                             
  Read 1 file (ctrl+o to expand)    
                                                   
⏺ 完璧. 이제 두 파일을 동시에 수정합니다.                                    
                                                                             
⏺ Update(docs/teaching-materials/강의자료-전체.html)                         
  ⎿  Added 3 lines                                                           
      2927                                                                   
      2928    // scroll slide area to top                                    
      2929    document.querySelector('.slide-area').scrollTop = 0            
      2930 +                                                                 
      2931 +  // sync script window                                          
      2932 +  try { localStorage.setItem('slide-sync', String(idx)) } 
           +catch(e) {}                                                      
      2933  }                                                                
      2934                                                                   
      2935  function nav(dir) {

⏺ Update(docs/teaching-materials/스크립트-전체강의.html)
  ⎿  Added 29 lines                                                          
      1333        window.scrollTo({ top: y, behavior: 'smooth' });
      1334      }                                                            
      1335    }                                                              
      1336 +                                                          
      1337 +  // ── slide sync ───────────────────────────────────────       
           +───────                                                   
      1338 +  const ALL_CARDS = () => document.querySelectorAll('.slid       
           +e-card');                                                 
      1339 +                                                          
      1340 +  function syncToSlide(idx) {                             
      1341 +    const cards = ALL_CARDS();                            
      1342 +    if (idx < 0 || idx >= cards.length) return;           
      1343 +    cards.forEach(c => c.classList.remove('sync-active'));
      1344 +    const card = cards[idx];                              
      1345 +    card.classList.add('sync-active');                    
      1346 +    const y = card.getBoundingClientRect().top + window.sc
           +rollY - 100;                                              
      1347 +    window.scrollTo({ top: y, behavior: 'smooth' });      
      1348 +  }                                                       
      1349 +                                                          
      1350 +  window.addEventListener('storage', e => {               
      1351 +    if (e.key !== 'slide-sync') return;                   
      1352 +    syncToSlide(parseInt(e.newValue, 10));                
      1353 +  });                                                     
      1354 +                                                          
      1355 +  // 페이지 열릴 때 현재 슬라이드로 초기 이동             
      1356 +  const _init = localStorage.getItem('slide-sync');       
      1357 +  if (_init !== null) syncToSlide(parseInt(_init, 10));   
      1358  </script>
      1359 +<style>                                                   
      1360 +  .slide-card.sync-active {                               
      1361 +    border-left: 4px solid #3b82f6;                       
      1362 +    background: #eff6ff;                                  
      1363 +    box-shadow: 0 0 0 2px rgba(59,130,246,0.15);          
      1364 +  }                                                       
      1365 +</style>                                                  
      1366  </body>
      1367  </html>

⏺ 변경 내용을 검증합니다.                             
                                                                             
  Read 2 files (ctrl+o to expand)    
                                                   
⏺ 완료됐습니다.                                                              
                                                                             
  동작 방식:                                                                 
  - localStorage + storage 이벤트 사용 — 서버 없이 file:// 프로토콜에서 동작
  - 슬라이드 뷰어에서 화살표/키보드로 넘길 때마다 전역 인덱스(0~80)를        
  localStorage에 씀                                                          
  - 스크립트 창이 이벤트를 받아 해당 순서의 .slide-card로 스크롤 + 파란      
  테두리 하이라이트                                                          
                                                                             
  사용법:                                                                    
  1. Chrome 두 창에서 각각 파일 열기                                         
  2. 스크립트 창을 나중에 열면 현재 슬라이드 위치로 자동 이동                
  3. 슬라이드 뷰어에서 77번으로 이동 → 스크립트 창이 77번째 카드(Slide
  6-15)로 자동 스크롤                                                        
                                                                             
  주의: Chrome에서 file:// 페이지는 같은 프로필 내에서 localStorage를        
  공유하므로 별도 서버가 불필요합니다. 