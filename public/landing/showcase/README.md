# Style showcase screenshots

The landing page product section runs a counter-scrolling belt of interface
screenshots. Drop the images here using these exact filenames:

    style-01.png
    style-02.png
    style-03.png
    style-04.png
    style-05.png
    style-06.png

They are cropped to 16:10 from the top, and rendered at up to 400px wide —
export at roughly 1440x900 or larger so they stay sharp on retina.

To add, remove or rename slots, edit `SHOWCASE_SHOTS` in
`src/landing/showcase-data.ts`. Any listed file that is missing removes itself
at runtime, so the belt never shows a broken image.
