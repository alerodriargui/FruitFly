"""Verify genuine MuJoCo stepping, movement, contacts and user controls."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=True)
    page=browser.new_page(viewport={'width':1440,'height':1000})
    errors=[]
    page.on('pageerror',lambda error: errors.append(str(error)))
    page.goto('http://127.0.0.1:8766/habitat.html')
    try:
        page.wait_for_function('window.habitatState?.ready',timeout=90000)
        first=page.evaluate('window.habitatState')
        print('Initial:',first,flush=True)
        page.wait_for_function('window.habitatState.simulationTime > 0.3 && window.habitatState.distance > 0.5',timeout=60000)
        state=page.evaluate('window.habitatState')
        assert state['finite'] and state['joints']>30 and state['actuators']>=42,state
        assert state['contacts']>0,state
        page.wait_for_function('window.habitatState.simulationTime > 2 || window.habitatState.finished',timeout=60000)
        route_state=page.evaluate('window.habitatState')
        assert route_state['waypoint'] >= 2 and route_state['finite'],route_state
        page.locator('#pause').click()
        page.wait_for_function('window.habitatState.paused')
        paused=page.evaluate('window.habitatState.simulationTime')
        page.wait_for_timeout(350)
        assert page.evaluate('window.habitatState.simulationTime')==paused
        iframe=page.frames[1]
        before=iframe.evaluate('window.habitat.contactFriction()')
        page.locator('#friction').fill('0.5')
        after=iframe.evaluate('window.habitat.contactFriction()')
        assert abs(after[0]-before[0]*.5)<1e-9
        page.locator('#friction').fill('1')
        page.locator('[data-key="w"]').click()
        page.wait_for_function('window.habitatState.automatic === false')
        assert page.evaluate('window.habitatState.gains')==[1,1]
        page.locator('[data-key="q"]').click()
        page.wait_for_function('window.habitatState.gains.every(x=>x===0)')
        page.locator('#mode').select_option('auto')
        page.locator('#center').click()
        page.screenshot(path=str(ROOT/'results/habitat.png'),full_page=True)
        page.set_viewport_size({'width':390,'height':844})
        page.screenshot(path=str(ROOT/'results/habitat-mobile.png'),full_page=True)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        assert not errors,errors
        (ROOT/'results/habitat-validation.json').write_text(json.dumps({'initial':first,'moving':state,'route':route_state,'errors':errors},indent=2),encoding='utf-8')
        print('PASS:',state,flush=True)
    except Exception:
        print('ERRORS',errors,flush=True)
        print(page.frames[1].locator('body').inner_text(),flush=True)
        page.screenshot(path=str(ROOT/'results/habitat-error.png'),full_page=True)
        raise
    finally:
        browser.close()
