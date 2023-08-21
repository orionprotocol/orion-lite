// Select elements from DOM
const metamaskButton = document.querySelector('.enableMetamask');
const accountBlock = document.getElementById('account');
const showAccount = document.querySelector('.showAccount');
const form = document.getElementById('form');
const chain = document.getElementById('chain');
const spendingAssetSelect = document.getElementById('spendingAsset');
const receivingAssetSelect = document.getElementById('receivingAsset');
const amountInput = document.getElementById('amount');
const priceRequestButton = document.getElementById('priceRequest');
const logContainer = document.getElementById('logContainer');
const errorContainer = document.getElementById('errorContainer');
const swapContainer = document.getElementById('swap');
const price = document.getElementById('price');
const amountOut = document.getElementById('amountOut');
const swapBtn = document.getElementById('swapBtn');
const feeAssetSelect = document.getElementById('feeAsset');


const swapExpirationSec = 10; // Swap limit 10 seconds

// Import entities from SDK

const { simpleFetch } = stf;
const { Unit } = orion;

let account;
let signer;
let currentOrionUnit;

let spendingAssetSelected = false;
let receivingAssetSelected = false;
let swapButtonInterval;

function clearAmount() {
    amountInput.disabled = true;
    amountInput.value = '';
}

function displayError(errorMessage) {
    errorContainer.innerHTML = errorMessage;
    setTimeout(() => {
        errorContainer.innerHTML = '';
    }, 5000);
}

function clearPairs() {
    spendingAssetSelect.disabled = true;
    receivingAssetSelect.disabled = true;
    Array.from(spendingAssetSelect.children).forEach((child) => {
        if (child.value !== '') spendingAssetSelect.removeChild(child);
    })
    Array.from(receivingAssetSelect.children).forEach((child) => {
        if (child.value !== '') receivingAssetSelect.removeChild(child);
    })
}

function clearFeeAssets() {
    feeAssetSelect.disabled = true;
    Array.from(feeAssetSelect.children).forEach((child) => {
        if (child.value !== '') feeAssetSelect.removeChild(child);
    })
}

async function fillPairs() {
    const pairs = await simpleFetch(currentOrionUnit.aggregator.getPairsList)('spot');
    const tradableAssets = pairs.reduce((acc, pair) => {
        const [base, quote] = pair.split('-');
        return [...acc, base, quote]
    }, []);

    console.log(pairs);

    const uniqueTradableAssets = [...new Set(tradableAssets).values()];
    const sortedTradableAssets = uniqueTradableAssets.sort((a, b) => {
        if (a < b) return -1;
        if (a > b) return 1;
        return 0;
    });

    sortedTradableAssets.forEach((pair) => {
        const option = document.createElement('option');
        option.value = pair;
        option.innerText = pair;
        spendingAssetSelect.appendChild(option);
        receivingAssetSelect.appendChild(option.cloneNode(true));
    });
    spendingAssetSelect.disabled = false;
    receivingAssetSelect.disabled = false;
}

async function fillFeeAssets() {
    const feeAssets = await simpleFetch(currentOrionUnit.blockchainService.getTokensFee)();
    Object.entries(feeAssets).forEach(([asset, fee]) => {
        const option = document.createElement('option');
        option.value = asset;
        option.innerText = asset + ' (' + fee + '%)';
        feeAssetSelect.appendChild(option);
    })
    feeAssetSelect.disabled = false;
}

// Track chain changes
chain.addEventListener('change', (e) => {
    clearPairs();
    clearAmount();
    clearFeeAssets();
    if (e.target.value) {
        currentOrionUnit = new Unit({
            env: 'testing',
            chainId: e.target.value
        });
        fillPairs();
        fillFeeAssets();
    }
})

swapBtn.addEventListener('click', () => {
    currentOrionUnit.exchange.swapMarket({
        type: "exactSpend",
        assetIn: spendingAssetSelect.value,
        assetOut: receivingAssetSelect.value,
        feeAsset: feeAssetSelect.value,
        amount: amountInput.value,
        slippagePercent: 1,
        signer,
        options: {
            logger: log,
            autoApprove: true,
        },
    })
        .then(log)
        .catch(displayError)
});

spendingAssetSelect.addEventListener('change', (e) => {
    spendingAssetSelected = !!e.target.value;
    if (spendingAssetSelected && receivingAssetSelected) {
        amountInput.disabled = false;
        priceRequestButton.disabled = false;
    } else clearAmount();
});

receivingAssetSelect.addEventListener('change', (e) => {
    receivingAssetSelected = !!e.target.value;
    if (receivingAssetSelected && spendingAssetSelected) {
        amountInput.disabled = false;
        priceRequestButton.disabled = false;
    } else clearAmount();
});

function terminateSwap() {
    clearInterval(swapButtonInterval);
    priceRequestButton.style.display = '';
    swapContainer.style.display = 'none';
}

function log(message) {
    let content;
    if (typeof message === 'string') content = message;
    else content = JSON.stringify(message, null, 2);
    const node = document.createElement('p');
    node.innerHTML = content;
    logContainer.appendChild(node);
}

async function requestPrice() {
    try {
        const swapInfo = await simpleFetch(currentOrionUnit.aggregator.getSwapInfo)(
            'exactSpend',
            spendingAssetSelect.value,
            receivingAssetSelect.value,
            amountInput.value
        );
        if (swapInfo.marketPrice !== null) {
            price.textContent = `1 ${spendingAssetSelect.value} = ${swapInfo.marketPrice} ${receivingAssetSelect.value}`;
            amountOut.textContent = `${amountInput.value} ${spendingAssetSelect.value} => ${swapInfo.amountOut} ${receivingAssetSelect.value}`;
            priceRequestButton.style.display = 'none';
            swapContainer.style.display = 'block';

            let remainingSec = swapExpirationSec;
            swapButtonInterval = setInterval(() => {
                if (remainingSec === 0) terminateSwap();
                else {
                    swapBtn.innerHTML = `Swap (${remainingSec})`;
                    remainingSec -= 1;
                }
            }, 1000);
        } else displayError(swapInfo.executionInfo);
    } catch (e) {
        displayError(e.message);
    }
}

priceRequestButton.addEventListener('click', requestPrice);

async function getAccount() {
    const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
    account = accounts[0];
    showAccount.innerHTML = account;

    const web3Provider = new ethers.providers.Web3Provider(ethereum);
    await web3Provider.ready;
    signer = web3Provider.getSigner();

    accountBlock.style.display = 'block';
    metamaskButton.style.display = 'none';
}


if (typeof window.ethereum !== 'undefined') {
    metamaskButton.addEventListener('click', getAccount);
    console.log('MetaMask is installed!');
} else {
    metamaskButton.title = "Metamask not available in your browser. Please use Chrome or Firefox.";
    metamaskButton.disabled = true;
}