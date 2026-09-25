with open('c:/temp/abyss_full.html', 'r', encoding='utf-8') as f:
    html = f.read()

import re

# Let's clean and patch html
# 1. Remove anti-embed check
html = html.replace("top.location == self.location", "false")
html = html.replace("top.location==self.location", "false")

# 2. Remove all popup URLs so urls array is always empty
html = re.sub(r'var urls = \[.*?\];', 'var urls = [];', html)
html = re.sub(r'urls = \[.*?\];', 'urls = [];', html)

# 3. Prevent jwplayer().remove() and error screen
html = html.replace("track.window >= 2", "false")
html = html.replace("jwplayer().remove()", "/* removed */")

# 4. Remove overlay element completely from the HTML
html = html.replace('<div id="overlay"></div>', '')
html = html.replace("<div id='overlay'></div>", "")

# 5. Inject complete style & bridge
bridge_script = """
<style id="anilove-clean-style">
  html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; height: 100% !important; background: #000 !important; overflow: hidden !important; }
  #player { width: 100vw !important; height: 100vh !important; }
  #overlay, #loadingOverlay, #downloadButton, #moreOptionsBtn, .video-links-modal,
  .jw-controls, .jw-controlbar, .jw-display-icon-container, .jw-dock, .jw-nextup-container, .jw-logo, .jw-title, .jw-preview {
    display: none !important; opacity: 0 !important; pointer-events: none !important; visibility: hidden !important;
  }
  video { width: 100% !important; height: 100% !important; object-fit: contain !important; }
</style>
<script>
(function() {
  window.open = function() { return null; };
  window.open.toString = function() { return 'function open() { [native code] }'; };
  window.FuckAdBlock = function() { return { onDetected: function(){return this;}, onNotDetected: function(cb){if(cb)cb();return this;}, check: function(){return false;} }; };
  window.fuckAdBlock = new window.FuckAdBlock();
  window.blockAdBlock = window.fuckAdBlock;
  window.abyssConfig = { popups: [] };

  function hookJW() {
    if (typeof jwplayer === 'function') {
      var jp = jwplayer();
      if (jp && typeof jp.on === 'function') {
        try { jp.setMute(false); jp.setVolume(100); } catch(e){}
        if (jp.getState && (jp.getState() === 'idle' || jp.getState() === 'paused')) {
          try { jp.play(); } catch(e){}
        }
        jp.on('ready', function() {
          try { jp.setMute(false); jp.setVolume(100); jp.play(); } catch(e){}
        });
        jp.on('time', function(e) {
          if (window.AndroidScrubber && typeof window.AndroidScrubber.onStateUpdate === 'function') {
            window.AndroidScrubber.onStateUpdate(e.position, e.duration, jp.getState() === 'paused');
          }
        });
        jp.on('pause', function() {
          if (window.AndroidScrubber && typeof window.AndroidScrubber.onStateUpdate === 'function') {
            window.AndroidScrubber.onStateUpdate(jp.getPosition(), jp.getDuration(), true);
          }
        });
        jp.on('play', function() {
          if (window.AndroidScrubber && typeof window.AndroidScrubber.onStateUpdate === 'function') {
            window.AndroidScrubber.onStateUpdate(jp.getPosition(), jp.getDuration(), false);
          }
        });
      }
    }
    var v = document.querySelector('video');
    if (v) {
      if (v.muted) v.muted = false;
      if (v.volume < 1) v.volume = 1;
      if (v.paused) v.play().catch(function(){});
      if (window.AndroidScrubber && typeof window.AndroidScrubber.onStateUpdate === 'function') {
        window.AndroidScrubber.onStateUpdate(v.currentTime || 0, v.duration || 0, v.paused);
      }
    }
  }

  var poll = setInterval(hookJW, 500);
  document.addEventListener('DOMContentLoaded', hookJW);
  window.addEventListener('load', hookJW);
})();
</script>
"""
html = html.replace("<head>", "<head>\n" + bridge_script)
print("Patched AbyssPlayer HTML length:", len(html))
print("Contains overlay tag?", 'id="overlay"' in html)
print("Contains bridge_script?", 'hookJW' in html)
