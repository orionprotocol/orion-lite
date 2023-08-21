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

orionInstance.unitsArray.forEach((unit) => {
    unit.priceFeed.ws.subscribe('allTickers', {
        callback: (data) => {
            Object.entries(data).forEach(([pairName, priceData]) => {
                if (elements.has(pairName)) {
                    const element = elements.get(pairName);
                    element.innerHTML = `${pairName}: ${+priceData.lastPrice} (${unit.networkCode})`;
                } else {
                    const element = document.createElement('div');
                    element.innerHTML = `${pairName}: ${+priceData.lastPrice} (${unit.networkCode})`;
                    rootContainer.appendChild(element);
                    elements.set(pairName, element);

                    rootContainer.appendChild(element);
                }
            })
        }
    });
})
