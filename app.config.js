// Everything lives in app.json; this file only injects the Meta client token
// from the environment (local .env, or an EAS environment variable for
// cloud builds) so it is not committed to git.
module.exports = ({ config }) => {
    const clientToken = process.env.META_CLIENT_TOKEN;
    const plugins = (config.plugins || []).map((plugin) => {
        if (Array.isArray(plugin) && plugin[0] === 'react-native-fbsdk-next' && clientToken) {
            return [plugin[0], { ...plugin[1], clientToken }];
        }
        return plugin;
    });
    return { ...config, plugins };
};
