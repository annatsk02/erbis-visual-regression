const { chromium } = require('playwright')
const { expect } = require("expect");
const cp = require('child_process');
const playwrightClientVersion = cp.execSync('npx playwright --version').toString().trim().split(' ')[1];

const SCREEN_RESOLUTIONS = {
  mobile: { width: 390, height: 844 },
  desktop: { width: 1920, height: 1080 },
};

const CAPABILITIES = [
  {
    'browserName': 'Chrome',
    'browserVersion': 'latest',
    'LT:Options': {
      'platform': 'Windows 10',
      'build': 'Playwright With Parallel Build',
      'name': 'Playwright Sample Test on Windows 10 - Chrome',
      'user': process.env.LT_USERNAME,
      'accessKey': process.env.LT_ACCESS_KEY,
      'network': true,
      'video': true,
      'console': true,
      'playwrightClientVersion': playwrightClientVersion
    }
  },
  // {
  //   'browserName': 'MicrosoftEdge',
  //   'browserVersion': 'latest',
  //   'LT:Options': {
  //     'platform': 'MacOS Ventura',
  //     'build': 'Playwright With Parallel Build',
  //     'name': 'Playwright Sample Test on Windows 8 - MicrosoftEdge',
  //     'user': process.env.LT_USERNAME,
  //     'accessKey': process.env.LT_ACCESS_KEY,
  //     'network': true,
  //     'video': true,
  //     'console': true,
  //     'playwrightClientVersion': playwrightClientVersion
  //   }
  // },
  // {
  //   'browserName': 'pw-webkit',
  //   'browserVersion': 'latest',
  //   'LT:Options': {
  //     'platform': 'MacOS Big sur',
  //     'build': 'Playwright With Parallel Build',
  //     'name': 'Playwright Sample Test on MacOS Big sur - Chrome',
  //     'user': process.env.LT_USERNAME,
  //     'accessKey': process.env.LT_ACCESS_KEY,
  //     'network': true,
  //     'video': true,
  //     'console': true,
  //     'playwrightClientVersion': playwrightClientVersion
  //   }
  // }
];

const PAGE_NAMES = ['', 'company', 'culture'];

async function deleteWidget(page) {
  const widget = page.locator(".widget-visible");
  await widget.waitFor({ state: "attached" });
  await widget.evaluate(e => {
    e.remove();
  })
  await page.waitForTimeout(1000);
}


async function validatePage(context, capabilityName, pageName) {
  console.log('Navigating URL', capabilityName, pageName);

  try {
    const page = await context.newPage();

    await page.goto(`https://erbis.com/${pageName}/`);

    await deleteWidget(page);

    const screenshotName = `erbis-${pageName}-page`;

    await page.screenshot({
      fullPage: true,
      animations: "disabled",
      path: `./screenshots/${screenshotName}.png`,
    })

    const screenshotResponse =
      await page.evaluate(
        _ => { },
        `lambdatest_action: ${JSON.stringify({
          action: 'smartui.takeScreenshot',
          arguments: { fullPage: true, screenshotName },
        })}`
      );
    console.log("screenshotResp", screenshotResponse);

    await validateSmartUIScreenshots(page, screenshotName);
    console.log(`${capabilityName} validated screenshot: ${screenshotName} successfully`);
    return true;
  } catch (err) {
    console.error(err);
    await page.close();
    return false;
  }
}

const validateSmartUIScreenshots = async (page, screenshotName) => {
  try {
    await page.waitForTimeout(5000);

    await page.screenshot({
      fullPage: true,
      path: `./screenshots/${screenshotName}.png`,
    });

    let screenshotResponse = JSON.parse(
      await page.evaluate(
        console.log,
        `lambdatest_action: ${JSON.stringify({
          action: 'smartui.fetchScreenshotStatus',
          arguments: { screenshotName },
        })}`
      )
    );
    console.log('screenshotStatus response: ', screenshotResponse);
  } catch (error) {
    throw new Error(error);
  }
};


const runTest = async (args, capability) => {
  const capabilityName = capability['LT:Options']['name'];
  console.log('Initialising test:: ', capabilityName)

  const browser = await chromium.connect({
    wsEndpoint: `wss://cdp.lambdatest.com/playwright?capabilities=${encodeURIComponent(JSON.stringify(capability))}`
  })

  console.log('Browser Launched');

  const context = await browser.newContext({
    viewport: SCREEN_RESOLUTIONS[args.screenSize],
  });

  const resultPromises = PAGE_NAMES.map((pageName) => validatePage(context, capabilityName, pageName));
  try {
    const results = await Promise.all(resultPromises);
    console.log(`Completed ${capabilityName} with result: ${results}`);
  } catch (e) {
    console.error(`Failed to complete test:: ${capabilityName}, error: ${e}`);
    await browser.close();
  }
}

async function runTests(capabilities) {
  const args = parseCommandLineArgs();
  console.log(`args: ${JSON.stringify(args, null, 2)}`);

  const mappedCapabilities = capabilities.map(capability => {
    const browserName = capability['browserName'].toLowerCase();
    capability['LT:Options']['smartUIBaseline'] = args.isBaseline;
    // capability['LT:Options']['smartUIProjectName'] = `${browserName}_${args.screenSize}`;
    capability['LT:Options']['smartUIProjectName'] = `erbis`;
    return capability;
  });
  console.log(`running tests with capabilities: ${JSON.stringify(mappedCapabilities, null, 2)}`);

  
  return Promise.all(mappedCapabilities.map(async (capability) => await runTest(args, capability)));
}

function parseCommandLineArgs() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Insufficient arguments! Usage: node test_script.js <SCREEN_SIZE> <IS_BASELINE>');
    process.exit(1);
  }

  const screenSize = args[0].toLowerCase();
  const isBaseline = args[1].toLowerCase() === 'true';

  return { screenSize, isBaseline };
}

runTests(CAPABILITIES)
  .then(() => {
    console.log(`Script finished succesfully`);
    process.exit(0);
  })
  .catch(e => {
    console.error(`Failure during script run: ${e}`);
    process.exit(1);
  });


