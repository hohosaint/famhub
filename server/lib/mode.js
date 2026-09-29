// Live or test mode.
//   Test mode: demo people, the TEST MODE bar, profile switching and sample data.
//   Live mode: real accounts (email and password), no test tools, and a fresh install starts empty.
// App setting TEST_MODE: "true" = test mode, "false" = live mode. When it is not set,
// Azure runs in live mode and your PC runs in test mode.
function isLive() {
  if (process.env.TEST_MODE === 'true') return false;
  if (process.env.TEST_MODE === 'false') return true;
  return !!process.env.WEBSITE_SITE_NAME;
}
module.exports = { isLive };
