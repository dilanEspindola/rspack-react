import { rspack } from "@rspack/core";
import ReactRefreshPlugin from "@rspack/plugin-react-refresh";
import { watch, readdirSync, writeFile, readFileSync } from "fs";
import path from "path";
import { cwd } from "process";
import { ManifestPlugin } from "./plugins.mjs";

const isDev = process.env.NODE_ENV === "development";

const env = "development";
// const env = "production";

/** @type {import('@rspack/cli').Configuration} */
export default {
  cache: true,
  resolve: {
    extensions: [".js", ".jsx", ".ts", ".tsx"],
    alias: {
      "@/": path.resolve(import.meta.dirname, "src/"),
    },
  },
  mode: env,
  experiments: {
    css: true,
  },
  node: {
    global: true,
  },
  entry: { main: "./src/index.tsx" },
  output: {
    path: `${env === "development" ? `${path.resolve(import.meta.dirname, "dev")}` : `${path.resolve(import.meta.dirname, "dist")}`}`,
    publicPath: "/",
    filename: `${env === "development" ? "[name].js" : "[name].js"}`,
    chunkFilename: `${env === "development" ? "./chunks/[name].js" : "./chunks/[name].[contenthash].js"}`,
    assetModuleFilename: "[name].[contenthash][ext]",
    clean: true,
    sourceMapFilename: "[file].map",
  },
  devServer: {
    historyApiFallback: true,
    hot: env === "development",
    port: 3000,
    devMiddleware: {
      writeToDisk: true,
    },
    static: {
      directory: `${path.resolve(import.meta.dirname, "dev")}`,
    },
    proxy: [
      {
        context: ["/"],
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    ],
    setupMiddlewares: (middlewares, _devServer) => {
      const pagesDir = path.resolve(import.meta.dirname, "src/pages");
      const routeMap = new Map();

      const generateRouteFile = () => {
        const readAllFiles = (pagesDir) => {
          if (!pagesDir) return;

          const content = readdirSync(pagesDir, { encoding: "utf-8" });

          content.forEach((element) => {
            const pathEl = path.join(pagesDir, element);
            if (pathEl.includes("page.tsx")) {
              const url = pathEl.split("src")[1];
              const filePath = path.join("./src", url.replace(/\\/g, "/"));
              const fileContent = readFileSync(`${cwd()}/${filePath}`, {
                encoding: "utf-8",
              });
              const keyDirPath = url
                .split("pages")[1]
                .split("page.tsx")[0]
                .replace(/\\/g, "/");

              routeMap.set(keyDirPath, {
                filePath: filePath.replace(/\\/g, "/"),
                isSSR: fileContent.includes("use ssr"),
                path:
                  keyDirPath === "/"
                    ? "/"
                    : keyDirPath.replace(/(?:^\/+)|(?:\/+$)/g, ""),
                component: `() => import("${filePath}")`,
              });
            } else {
              readAllFiles(pathEl);
            }
          });
        };
        readAllFiles(pagesDir);

        const jsObject = `export const routes = {
            ${Array.from(routeMap.entries())
              .map(([path, config]) => {
                return `"${path}": {
                  filePath: "${config.filePath}",
                  isSSR: ${config.isSSR},
                  path: "${config.path}",
                  component: () => import("${config.filePath.replace(/^src\//, "./")}")
                }`;
              })
              .join(",\n")}
        };`;

        writeFile(`${import.meta.dirname}/src/routes.ts`, jsObject, (err) => {
          if (err) throw new Error("Error writing file: " + err);

          console.log("file written successfully");
        });
      };

      generateRouteFile();

      watch(pagesDir, { recursive: true }, (evenType, filename) => {
        console.log(`File ${filename} was ${evenType}`);
        generateRouteFile();
      });

      return middlewares;
    },
  },
  optimization: {
    minimize: true,
    splitChunks: {
      chunks: "all",
      minSize: 30000,
      maxSize: 0,
      minChunks: 1,
      cacheGroups: {
        pagesDir: {
          // test: /[\\/]pages[\\/]/,
          test: /[\\/]src[\\/]pages[\\/].*\.tsx?$/,
          // test: "./src/pages/**/*",
          name(module, chunks, cacheGroupKey) {
            const match = module.resource.match(
              /src[\\/]pages[\\/]([^\\/]+)\/page\.tsx?$/
            );
            return match ? match[1] : "page";
          },
          chunks: "async",
          filename: "pages/[name].[contenthash].js",
        },
      },
    },
  },
  module: {
    rules: [
      {
        test: /\.jsx$/,
        exclude: /node_modules/,
        use: {
          loader: "builtin:swc-loader",
          options: {
            jsc: {
              parser: {
                syntax: "ecmascript",
                jsx: true,
              },
              transform: {
                react: {
                  runtime: "automatic",
                  pragma: "React.createElement",
                  pragmaFrag: "React.Fragment",
                  refresh: env === "development",
                  development: env === "development",
                },
              },
            },
          },
        },
        type: "javascript/auto",
      },
      {
        test: /\.tsx$/,
        exclude: /node_modules/,
        use: {
          loader: "builtin:swc-loader",
          options: {
            sourceMap: true,
            jsc: {
              parser: {
                syntax: "typescript",
                tsx: true,
                decorators: true,
                dynamicImport: true,
              },
              transform: {
                react: {
                  runtime: "automatic",
                  refresh: env === "development",
                  development: env === "development",
                },
              },
            },
          },
        },
      },
      {
        test: /\.css$/i,
        exclude: /node_modules/,
        type: "css/auto",
        parser: { namedExports: false },
        options: {
          modules: true,
        },
      },
      {
        test: /\.ts$/,
        exclude: [/node_modules/],
        loader: "builtin:swc-loader",
        options: {
          jsc: {
            parser: {
              syntax: "typescript",
              decorators: true,
              dynamicImport: true,
            },
            transform: {
              react: {
                runtime: "automatic",
                refresh: env === "development",
                development: env === "development",
              },
            },
          },
        },
        type: "javascript/auto",
      },
      {
        test: /\.(png|jpe?g|gif|svg|webp|bmp|ico|woff2?|eot|ttf|otf)$/i,
        type: "asset/resource",
      },
    ],
  },
  plugins: [
    new rspack.HtmlRspackPlugin({
      template: "./index.html",
      minify: env === "production",
    }),
    env === "development" && new ReactRefreshPlugin(),
    // env === "development" && new rspack.HotModuleReplacementPlugin(),
    new ManifestPlugin(),
  ],
};
