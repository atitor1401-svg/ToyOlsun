// Everything lives in app.json; this file only injects values that must not be
// committed to git, from the environment (local .env, or EAS environment
// variables for cloud builds):
//   META_CLIENT_TOKEN     - Meta (Facebook) SDK client token
//   GOOGLE_SERVICES_JSON  - path to Firebase's google-services.json (an EAS
//                           "file" variable); needed for Android push.
//                           Locally, falls back to ./google-services.json.
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
    const clientToken = process.env.META_CLIENT_TOKEN;
    const plugins = (config.plugins || []).map((plugin) => {
        if (Array.isArray(plugin) && plugin[0] === 'react-native-fbsdk-next' && clientToken) {
            return [plugin[0], { ...plugin[1], clientToken }];
        }
        return plugin;
    });

    const localGoogleServices = path.join(__dirname, 'google-services.json');
    const googleServicesFile =
        process.env.GOOGLE_SERVICES_JSON ||
        (fs.existsSync(localGoogleServices) ? './google-services.json' : undefined);

    const android = { ...config.android };
    if (googleServicesFile) android.googleServicesFile = googleServicesFile;

    return { ...config, android, plugins };
};
