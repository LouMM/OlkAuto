delete process.env.TS_NODE_PROJECT;

import * as webpack from "webpack";
import * as fs from "fs";
import type { Configuration as DevServerConfiguration } from "webpack-dev-server";
import { ProcessEnvOptions } from "child_process";
import * as path from "path";
import HtmlWebpackPlugin from "html-webpack-plugin";
import lodash from "lodash";
import * as devCerts from "office-addin-dev-certs";

const appDirectory = fs.realpathSync(process.cwd());
const resolveApp = (relativePath: string) => path.resolve(appDirectory, relativePath);

async function getHttpsOptions() {
  const httpsOptions = await devCerts.getHttpsServerOptions();
  return { cacert: httpsOptions.ca, key: httpsOptions.key, cert: httpsOptions.cert };
}
// Runs as part of prebuild step to generate a list of identifier -> name mappings for  iOS
const httpsOptions = (async () => {
  const options = await getHttpsOptions();
  return options;
})();

type Configuration = DevServerConfiguration & webpack.Configuration;

interface procenv {
  [key: string]: string | undefined;
}

const isEnvProduction = process.env.NODE_ENV === "production";
const isEnvDevelopment = process.env.NODE_ENV === "development";

const commonConfig: Configuration = {
  devtool: isEnvDevelopment ? "source-map" : false,
  mode: isEnvProduction ? "production" : "development",
  output: {
    pathinfo: true,
    path: path.resolve(__dirname, "dist"),
    globalObject: "this",
  },
  resolve: {
    alias: {
      commands: path.resolve(__dirname, "/src/commands"),
      taskpane: path.resolve(__dirname, "/src/taskpane"),
      autorun: path.resolve(__dirname, "/src/autorun"),
    },
    //Add resolving for ts and tsx extensions
    extensions: [".ts", ".tsx", ".js", ".jsx"],
    modules: ["node_modules", resolveApp("node_modules")],
    fallback: {
      fs: false,
      path: false,
      os: false,
    },
  },
  module: {
    strictExportPresence: true,
    rules: [
      //All files that have ts/tsx should be handled by the ts-loader
      { test: /\.tsx?$/, loader: "ts-loader" },
      {
        test: /\.(scss|css)$/,
        use: ["style-loader", "css-loader"],
      },
      {
        test: /\.(jpg|png|svg|ico|icns)$/,
        loader: "file-loader",
        options: {
          name: "[path][name].[ext]",
        },
      },
    ],
  },
};

const commandsConfig: Configuration = lodash.cloneDeep(commonConfig);
commandsConfig.entry = { commands: ["./src/commands/commands.ts"], events: ["./src/autorun/events.ts"] };
commandsConfig.output = {
  filename: "[name].js",
};

//commandsConfig.target = 'electron-main';
//if (commandsConfig.output) commandsConfig.output.filename = "commands.js";

commandsConfig.plugins = [
  new HtmlWebpackPlugin({
    template: path.resolve(__dirname, "./src/commands/commands.html"),
    filename: "commands.html",
  }),
  new webpack.ProvidePlugin({
    React: "react",
  }),
];

const taskpaneConf = async (): Promise<Configuration> => {
  let config = lodash.cloneDeep(commonConfig);
  config.entry = "./src/taskpane/taskpane.ts";
  //taskpaneConfig.target = 'electron-renderer';
  if (config.output) config.output.filename = "taskpane.js";

  config.devServer = {
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
    https: await getHttpsOptions(),
    port: process.env.npm_package_config_dev_server_port || 3000,
  };
  config.plugins = [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, "./src/taskpane/taskpane.html"),
      filename: "taskpane.html",
    }),
    new webpack.ProvidePlugin({
      React: "react",
    }),
  ];
  return config;
};
/*
const taskpaneConfig: Configuration = lodash.cloneDeep(commonConfig);
taskpaneConfig.entry = "./src/taskpane/taskpane.ts";
//taskpaneConfig.target = 'electron-renderer';
if (taskpaneConfig.output) taskpaneConfig.output.filename = "taskpane.js";

taskpaneConfig.devServer = {
  headers: {
    "Access-Control-Allow-Origin": "*",
  },
  https: env.WEBPACK_BUILD || options.https !== undefined ? options.https : getHttpsOptions(),
  port: process.env.npm_package_config_dev_server_port || 3000,
};
taskpaneConfig.plugins = [
  new HtmlWebpackPlugin({
    template: path.resolve(__dirname, "./src/taskpane/taskpane.html"),
    filename: "taskpane.html",
  }),
  new webpack.ProvidePlugin({
    React: "react",
  }),
];
//https://github.com/Devtography/electron-react-typescript-webpack-boilerplate/blob/master/package.json
*/
module.exports = [taskpaneConf, commandsConfig];
