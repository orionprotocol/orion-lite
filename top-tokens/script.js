const { simpleFetch } = stf;
const { Orion } = orion;

const orionInstance = new Orion();

const rootContainer = document.getElementById('root');

let elements = new Map();

// Websocket

const clearElements = () => {
    rootContainer.innerHTML = '';
    elements.clear();
}

const quoteAsset = 'USDT';
const TOP = 20;

function toClassicNotation(num) {
    let n = Number(num);

    // Return immediately if the number is not in scientific notation
    if (String(n).indexOf('e') === -1) {
        return String(n);
    }

    // Convert to classic notation
    let sign = n < 0 ? "-" : "";
    let str = Math.abs(n).toExponential();
    let [base, exponent] = str.split("e");

    // Convert base and exponent to numbers
    base = Number(base);
    exponent = Number(exponent);

    // Create the new "classic" string representation
    let classicStr = "";

    if (exponent > 0) {
        let move = base.toString().replace(".", "");
        let zeros = exponent - (move.length - 1);
        for (let i = 0; i < zeros; i++) {
            move += "0";
        }
        classicStr = move;
    } else {
        let decimalPosition = base.toString().length - 1;
        classicStr = "0.";
        while (exponent < -1) {
            classicStr += "0";
            exponent++;
        }
        classicStr += base.toString().replace(".", "");
    }

    return sign + classicStr;
}


(async () => {
    const pairVolumes = new Map();
    // Merge volumes
    for (const unit of orionInstance.unitsArray) {
        const { topPairs } = await simpleFetch(unit.priceFeed.getTopPairStatistics)();
        for (const pairData of topPairs) {
            const { assetPair, statisticsOverview } = pairData;
            const { volume24h } = statisticsOverview;

            const pairVolume = pairVolumes.get(assetPair);
            if (pairVolume) {
                pairVolumes.set(assetPair.toUpperCase(), pairVolume + volume24h);
            } else {
                pairVolumes.set(assetPair.toUpperCase(), volume24h);
            }
        }
    }

    // Sort by volume
    const sortedPairs = [...pairVolumes.entries()].sort((a, b) => b[1] - a[1]);
    const pairsWithQuoteAsset = sortedPairs.filter(([pairName]) => pairName.endsWith(quoteAsset));
    const topPairsMap = new Map(pairsWithQuoteAsset.slice(0, TOP));

    // Subscribe to prices in all available units (networks)
    for (const unit of orionInstance.unitsArray) {
        unit.priceFeed.ws.subscribe('allTickers', {
            callback: (data) => {
                Object.entries(data).forEach(([pairName, priceData]) => {
                    if (!topPairsMap.has(pairName)) {
                        return;
                    }

                    const [baseAsset] = pairName.split('-');

                    const { openPrice, lastPrice } = priceData
                    const change24h = openPrice === "0"
                        ? '0'
                        : (parseFloat(lastPrice) / parseFloat(openPrice) - 1) * 100;

                    // Create elements
                    // 1. Asset element
                    const assetElement = document.createElement('div');
                    assetElement.classList.add('asset');
                    assetElement.innerHTML = baseAsset;

                    // 2. Price element
                    const priceElement = document.createElement('div');
                    priceElement.classList.add('price');
                    priceElement.innerHTML = `$${toClassicNotation(priceData.lastPrice)}`;

                    // 3. Price change element
                    const priceChangElem = document.createElement('div');
                    priceChangElem.classList.add('price-change');
                    priceChangElem.innerHTML = `${change24h.toFixed(2)}%`;
                    if (change24h > 0) {
                        priceChangElem.classList.add('price-change--up');
                    } else if (change24h < 0) {
                        priceChangElem.classList.add('price-change--down');
                    }

                    if (elements.has(pairName)) {
                        const element = elements.get(pairName);
                        // Replace asset, price and price change in existing element
                        element.innerHTML = '';
                        element.appendChild(assetElement);
                        element.appendChild(priceElement);
                        element.appendChild(priceChangElem);
                    } else {
                        const element = document.createElement('div');
                        element.classList.add('pair');
                        element.appendChild(assetElement);
                        element.appendChild(priceElement);
                        element.appendChild(priceChangElem);
                        rootContainer.appendChild(element);
                        elements.set(pairName, element);

                        rootContainer.appendChild(element);
                    }
                })
            }
        });
    }
})()
