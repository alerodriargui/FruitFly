"""Browser smoke check using locally installed Chrome; no browser download."""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    page = browser.new_page(viewport={'width': 1440, 'height': 1000}, device_scale_factor=1)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto((ROOT / 'web/index.html').as_uri())
    page.wait_for_function('window.viewerState && window.viewerState.ready', timeout=60000)
    total = page.evaluate('window.viewerState.visible')
    assert total > 100000
    page.locator('#play').click()
    page.wait_for_function('window.viewerState.time > 10')
    page.locator('#play').click()
    page.locator('#mode').select_option('activity')
    page.wait_for_function('window.viewerState.visible === window.BRAIN_DATA.activeLocated')
    page.locator('#edges').check()
    page.wait_for_function('window.viewerState.lineCount > 0')
    neuron = page.evaluate('window.BRAIN_DATA.nodes.find(n => n[8].length)[0]')
    page.locator('#neuronId').fill(neuron)
    page.locator('#search button').click()
    page.wait_for_function('(id) => window.viewerState.selected === id', arg=neuron)
    assert neuron in page.locator('#detail').inner_text()
    page.locator('#condition').select_option('rest')
    page.wait_for_function('window.viewerState.condition === "rest"')
    assert 'Reposo: 0 impulsos' in page.locator('#events').inner_text()
    page.locator('#condition').select_option('sugar')
    page.locator('#edges').uncheck()
    page.locator('#reset').click()
    page.locator('#time').fill('45')
    page.wait_for_function('window.viewerState.time === 45')
    (ROOT / 'results').mkdir(exist_ok=True)
    page.screenshot(path=str(ROOT / 'results/cerebro-3d.png'))
    pixels = page.evaluate('''() => {const c=document.getElementById('brain'),g=c.getContext('webgl');
      const a=new Uint8Array(c.width*c.height*4);g.readPixels(0,0,c.width,c.height,g.RGBA,g.UNSIGNED_BYTE,a);
      let count=0;for(let i=3;i<a.length;i+=4)if(a[i]>0)count++;return count;}''')
    assert pixels > 10000, pixels
    page.set_viewport_size({'width':390,'height':844})
    page.screenshot(path=str(ROOT / 'results/cerebro-movil.png'))
    assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
    assert not errors, errors
    print({'visible_neurons':total,'rendered_pixels':pixels,'javascript_errors':errors,'interaction_checks':'passed'})
    browser.close()
