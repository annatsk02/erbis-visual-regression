const { chromium, firefox, webkit } = require('playwright');

const browserNames = {
  chromium: chromium,
  firefox: firefox,
  webkit: webkit,
};

const browserNameToCapability = {
  chromium: 'Chrome',
  firefox: 'pw-firefox',
  webkit: 'pw-webkit',
}

const browserNameToPlatform = {
  chromium: 'Windows 10',
  firefox: 'Windows 10',
  webkit: 'MacOS Ventura',
};

const screenResolutions = {
  mobile: { width: 390, height: 844 },
  desktop: { width: 1920, height: 1080 },
};

function parseCommandLineArgs() {
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.error('Insufficient arguments! Usage: node test_script.js <BROWSER_NAME> <SCREEN_SIZE> <IS_BASELINE>');
    process.exit(1);
  }

  const browserName = args[0].toLowerCase();
  const screenSize = args[1].toLowerCase();
  const isBaseline = args[2].toLowerCase() === 'true';

  return { browserName, screenSize, isBaseline };
}

async function deleteWidget(page) {
  console.log('Searching for widget...')
  const widget = page.locator(".widget-visible");
  console.log('Waiting for widget to appear...')
  await widget.waitFor({state: "attached"});
  console.log('Removing widget...');
  await widget.evaluate(e => {
    e.remove();
  })
  console.log('Widget removed');
  await page.waitForTimeout(1000);
}

async function forceLazyImagesLoad(page) {
  await page.evaluate(async () => {
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    for (let i = 0; i < document.body.scrollHeight; i += 100) {
      window.scrollTo(0, i);
      await delay(20);
    }
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  console.log('Page scrolled down');
}

(async () => {
  const args = parseCommandLineArgs();
  console.log(`args: ${JSON.stringify(args, null, 2)}`);
  const { browserName, screenSize, isBaseline } = args;

  const capabilities = {
    browserName: browserNameToCapability[browserName],
    browserVersion: 'latest',
    'LT:Options': {
      platform: browserNameToPlatform[browserName],
      build: 'Playwright SmartUI',
      name: `SmartUI Test ${browserName} ${screenSize}`,
      user: process.env.LT_USERNAME,
      accessKey: process.env.LT_ACCESS_KEY,
      network: true,
      video: true,
      console: true,
      smartUIProjectName: getSmartUIProjectName(browserName, screenSize),
      smartUIBaseline: isBaseline,
      github: {
        url: process.env.GITHUB_URL,
      },
    },
  };

  function getSmartUIProjectName(browser, screenSize) {
    const projectNames = {
      'chromium_mobile': 'chrome_mobile',
      'chromium_desktop': 'chrome_desktop',
      'firefox_mobile': 'firefox_mobile',
      'firefox_desktop': 'firefox_desktop',
      'webkit_mobile': 'webkit_mobile',
      'webkit_desktop': 'webkit_desktop',
    };

    const projectKey = `${browser}_${screenSize}`;
    return projectNames[projectKey];
  }

  const browser = await browserNames[browserName].connect({
    wsEndpoint: `wss://cdp.lambdatest.com/playwright?capabilities=${encodeURIComponent(
      JSON.stringify(capabilities)
    )}`,
  });

  console.log('Browser Launched');

  const context = await browser.newContext({
    viewport: screenResolutions[screenSize],
  });

  const page = await context.newPage();

  const pageNames = ['', 'company', 'culture', 'testimonials', 'how-we-work', 'contact','case-studies',

  'services', 'services/software-engineering', 'services/product-development', 'services/big-data-cloud-migration', 'services/tech-client-support',
  'services/discovery-phase', 'services/digital-transformation', 'services/ui-ux-design', 'services/mobile-development', 

  'real-estate-software-development-services',

  'industries', 'industries/scm-supply-chain-management-software-solutions', 'industries/fintech-solutions', 'industries/healthcare-software-development', 
  'industries/construction-real-estate-software', 'industries/retail-software-development', 'industries/automotive-software-development', 

  'blog', 'blog/mobile-app-ui-design-what-to-look-out-for-in-2023',

  'careers', 'careers/jobs/full-stack-engineer-java-typescript', 

  'policy/privacy', 'policy/cookie', 

  'projects/property-management-app', 'projects/hoste', 'projects/cloud-structure-for-saas', 
  'projects/vsb', 'projects/w-health', 'projects/project-web'];

  const results = [];
  for (let pageName of pageNames) {
    const isSuccess = await validatePage(page, pageName);
    results.push({isSuccess, pageName});
  }
  
  await teardown(page, browser);

  const failedPages = results
    .filter(result => !result.isSuccess)
    .map(result => result.pageName);

  if (failedPages.length > 0) {
     throw new Error(`Changes found for ${failedPages}`);
  }
})();

async function teardown(page, browser) {
  await page.close();
  await browser.close();
}

async function validatePage(page, pageName) {
  console.log('Navigating URL', pageName);

    await page.goto(`https://erbis.com/${pageName}/`);

    await deleteWidget(page)
    await forceLazyImagesLoad(page)

    const screenshotName = `erbis-${pageName}-page`;

    console.log('Taking Screenshot');

   await page.screenshot({
      fullPage: true,
      animations: "disabled",
      path: `./screenshots/${screenshotName}.png`,
    })

    console.log('log before evaluate lol');

    let screenshotResponse = 
      await page.evaluate(
        _ => {}, 
        `lambdatest_action: ${JSON.stringify({
          action: 'smartui.takeScreenshot',
          arguments: { fullPage: true, screenshotName },
        })}`
      );

    console.log("screenshotResp", screenshotResponse);

    try {
      await validateSmartUIScreenshots(page, screenshotName);
      return true;
    } catch (err) {
      console.error(err)
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
