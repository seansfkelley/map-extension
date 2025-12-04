# Mercator Schmercator

Per [xkcd](https://xkcd.com/977/).

Tired of every map everywhere being Mercator? Wish you could choose a more suitable projection for the data being shown? Or just read that xkcd about map projections one too many times? This extension is for you!

When you come across a Mercator world map and it's just not the right tool for the job, just right-click, hit Mercator Schmercator, and choose your favorite projection!

![screenshot](./screenshots/annotated.png)

## Development

Install dependencies:

```
npm install
```

Build the extension:

```
npm run build
```

Load the extension in your browser:

- **Chrome**: Go to `chrome://extensions`, enable Developer mode, click "Load unpacked", select this directory
- **Firefox**: Go to `about:debugging#/runtime/this-firefox`, click "Load Temporary Add-on", select `manifest.json`

## Packaging

Create a zip file for web store upload:

```
npm run package
```
