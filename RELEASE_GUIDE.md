# PunchPulse: release guide

The game is finished. These steps need your accounts or a headset, so you have to do them.

---

## 1. Test on your PC (no headset)
1. Open a terminal in this folder and run `npx serve .`
2. Open http://localhost:3000/?dev=1 in Chrome. `?dev=1` unlocks the Pro content for testing.
3. Click **Desktop preview** to play with the mouse. Click menu buttons to select them. During a workout, put the glove on a target and **click** (or press **Space**) to punch, or **hold the mouse button and sweep** across targets. Press `Esc` to pause.
4. To test VR, install the **Immersive Web Emulator** extension, open DevTools, go to the **WebXR** tab and click **Enter VR**.
   - Add `&test=1` to the URL so any glove touch counts as a punch. That makes testing in the emulator much easier.

## 2. Put it online (GitHub Pages, free)
1. Push the folder to a GitHub repo called `punchpulse`:
   ```
   git init
   git add .
   git commit -m "PunchPulse v1.0"
   git branch -M main
   git remote add origin https://github.com/<you>/punchpulse.git
   git push -u origin main
   ```
2. On GitHub, go to the repo's **Settings → Pages** and set the source to **main / root**.
3. Your game is live at `https://<you>.github.io/punchpulse/`

## 3. Test on a real Quest (borrow one for an hour)
Open your GitHub Pages link in the Quest **Browser** and click **Enter VR**. Check:
- [ ] The game runs smoothly, with no stutter (it needs at least 72 FPS)
- [ ] Punches register well. If they're too hard or too easy, change `MIN_PUNCH_SPEED` in `src/config.js`
- [ ] Opening the Meta menu pauses the game
- [ ] Taking the headset off pauses the game
- [ ] Take 5 screenshots and record a 30–60 second trailer clip

## 4. Meta developer account and app
1. Go to https://developers.meta.com/horizon/ and create a developer account and an organization.
2. In the Developer Dashboard, choose **Create new app** and pick **Meta Horizon Store**.
3. Fill in the details from `store/STORE_LISTING.md` and upload the art from `store/`.
4. Go to **Monetization → Add-ons** and create the SKU `punchpulse_pro` (type Durable, $4.99).
5. Complete the **Data Use Checkup** (in-app purchases require it), the age rating questions and the privacy policy URL.

## 5. Package as a Quest app (APK) with Bubblewrap
Follow Meta's guide: https://developers.meta.com/horizon/documentation/web/pwa-packaging/
1. Install Meta's forked **Bubblewrap** CLI from that page. On Windows, use Node.js 21.
2. Create a separate folder, outside this project, and run:
   ```
   bubblewrap init --manifest=https://<you>.github.io/punchpulse/manifest.webmanifest --metaquest
   ```
   - When it asks for the app mode, choose **immersive**.
   - Turn on **Horizon Store Billing**, which is needed for the Pro purchase, and paste your App ID from the dashboard.
   - Let it download the JDK and Android tools when it asks.
3. Run `bubblewrap build` to create `app-release-signed.apk`.
4. **Back up the keystore file and its passwords.** Every future update must be signed with the same key. If you lose it, you can't update the app.

## 6. Digital Asset Links (the app won't launch without this)
Bubblewrap creates `assetlinks.json`. It must be served at the **root of your domain**:
`https://<you>.github.io/.well-known/assetlinks.json`

That means it goes in your **`<you>.github.io` repo**, not in the punchpulse repo:
1. In that repo, create a `.well-known/assetlinks.json` file with the generated contents.
2. Add an empty file called `.nojekyll` to that repo's root. Without it, GitHub Pages hides folders that start with a dot.
3. Check that https://<you>.github.io/.well-known/assetlinks.json opens in a browser.

## 7. Upload and submit
1. In the Developer Dashboard, upload the APK to the **ALPHA** release channel first.
2. Add your own account as a tester and install it from the store on the Quest. Test the Pro purchase there, since purchases only work in store-installed builds.
3. When everything works, promote the build to **Production** and click **Submit for Review**. Review can take up to 2 weeks.
4. If Meta sends back **Changes Requested**, fix what it lists and resubmit.

## Updating the game later
1. Change the code, then bump `VERSION` in `sw.js` (for example `punchpulse-v1.0.1`) so players get the new files.
2. Push to GitHub. Because the app loads from your site, players get the update automatically.
3. You only need to rebuild the APK if the app ID, icon or manifest changes.
