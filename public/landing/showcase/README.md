# Style showcase screenshots

The landing page product section runs a counter-scrolling belt of interface
screenshots. Drop the images here using these exact filenames:

    style-01.jpg
    style-02.jpg
    style-03.jpg
    style-04.jpg
    style-05.jpg
    style-06.jpg

They are cropped to 16:10 from the top and rendered at up to 400px wide, so
1440px on the long edge is plenty — export at JPEG quality ~85 and expect
roughly 250-400KB per shot. Do not commit raw retina PNGs: everything under
`public/` ships verbatim, and a 3MB capture is a 3MB download for no visible
gain at this size.

Crop to the app viewport only. Full-screen captures carry the OS menu bar,
browser chrome (including the `localhost` URL) and the dock, all of which sit
in the top of the frame that the 16:10 crop keeps. Dismiss onboarding hints,
modals and toasts before capturing — they blur the dashboard behind them.

To add, remove or rename slots, edit `SHOWCASE_SHOTS` in
`src/landing/showcase-data.ts`. Any listed file that is missing removes itself
at runtime, so the belt never shows a broken image.
