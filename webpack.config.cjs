const path = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = {
  entry: "./js/app.js",
  mode: "production",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "app.js",
    clean: true,
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        {
          from: "index.html",
          to: "index.html",
          transform(content) {
            return Buffer.from(
              content
                .toString()
                .replace(
                  /<script type="module" src="js\/app\.js"><\/script>/,
                  '<script src="app.js"></script>'
                ),
              "utf8"
            );
          },
        },
        { from: "ui.css", to: "ui.css" },
        { from: "preview.png", to: "preview.png", noErrorOnMissing: true },
        { from: "909BD.mp3", to: "909BD.mp3", noErrorOnMissing: true },
        { from: "909OH.mp3", to: "909OH.mp3", noErrorOnMissing: true },
        { from: "909CH.mp3", to: "909CH.mp3", noErrorOnMissing: true },
        { from: "909SD.mp3", to: "909SD.mp3", noErrorOnMissing: true },
        {
          from: "link-bridge/README.txt",
          to: "link-bridge-README.txt",
          noErrorOnMissing: true,
        },
        {
          from: "bridge/README.txt",
          to: "bridge-README.txt",
          noErrorOnMissing: true,
        },
        {
          from: "osc-reference.html",
          to: "osc-reference.html",
          noErrorOnMissing: true,
        },
      ],
    }),
  ],
};
