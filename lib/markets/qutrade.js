const request = require('postman-request');
const base_url = 'https://qutrade.io/api/v1';
const market_url_template = 'https://qutrade.io/en/?market={coin}_{base}';

// initialize the rate limiter to wait 2 seconds between requests to prevent abusing external apis
const rateLimitLib = require('../ratelimit');
const rateLimit = new rateLimitLib.RateLimit(1, 2000, false);

function get_summary(coin, exchange, api_error_msg, cb) {
    const req_url = base_url + '/market_data/?pair=' + coin + '_' + exchange;

    // pause for 2 seconds before continuing
    rateLimit.schedule(function () {
        request({ uri: req_url, json: true }, function (error, response, body) {
            if (error)
                return cb(error, null);
            else if (body == null || body == '' || typeof body !== 'object')
                return cb(api_error_msg, null);
            else if (body.error != null)
                return cb((body.error.message != null ? body.error.message : api_error_msg), null);
            else {
                try {
                    let resBody = body.list.nux_usdt;
                    if (exchange === 'doge') {
                        resBody = body.list.nux_doge;
                    }
                    const summary = {
                        'high': parseFloat(resBody.high) || 0,
                        'low': parseFloat(resBody.low) || 0,
                        'volume': parseFloat(resBody.asset_1_volume) || 0,
                        'volume_btc': parseFloat(resBody.asset_2_volume) || 0,
                        'bid': parseFloat(resBody.bid) || 0,
                        'ask': parseFloat(resBody.ask) || 0,
                        'last': parseFloat(resBody.price) || 0,
                        'change': parseFloat(resBody.trend) || 0,
                        'liq': parseFloat(resBody.liquidity) || 0
                    };

                    return cb(null, summary);
                } catch (err) {
                    return cb(api_error_msg, null);
                }
            }
        });
    });
}

function get_trades(coin, exchange, api_error_msg, cb) {
    const req_url = base_url + '/market_trades/?pair=' + coin + '_' + exchange + '&limit=30';

    // pause for 2 seconds before continuing
    rateLimit.schedule(function () {
        request({ uri: req_url, json: true }, function (error, response, body) {
            if (error)
                return cb(error, null);
            else if (body == null || body == '' || typeof body !== 'object')
                return cb(api_error_msg, null);
            else if (body.error != null)
                return cb((body.error.message != null ? body.error.message : api_error_msg), null);
            else {
                try {
                    let trades = [];
                    let bodyr = body.list;

                    for (let t = 0; t < bodyr.length; t++) {
                        const tmstp = parseInt(bodyr[t].timestamp) + 10800;
                        trades.push({
                            ordertype: bodyr[t].side,
                            price: parseFloat(bodyr[t].price) || 0,
                            quantity: parseFloat(bodyr[t].amount) || 0,
                            timestamp: tmstp
                        });
                    }

                    return cb(null, trades);
                } catch (err) {
                    console.log(err);
                    return cb(api_error_msg, null);
                }
            }
        });
    });
}

function get_orders(coin, exchange, api_error_msg, cb) {
    const req_url = base_url + '/market_depth/?pair=' + coin + '_' + exchange + '&limit=30';

    // NOTE: no need to pause here because this is the first api call
    request({ uri: req_url, json: true }, function (error, response, body) {
        if (error)
            return cb(error, null, null);
        else if (body == null || body == '' || typeof body !== 'object')
            return cb(api_error_msg, null, null);
        else if (body.error != null)
            return cb((body.error.message != null ? body.error.message : api_error_msg), null, null);
        else {
            try {
                let buys = [];
                let sells = [];
                if (exchange === 'doge') {
                    for (let b = 0; b < 30; b++) {
                        buys.push({
                            price: parseFloat(body.list.nux_doge.bids[b][0]) || 0,
                            quantity: parseFloat(body.list.nux_doge.bids[b][1]) || 0
                        });
                    }

                    for (let s = 0; s < 30; s++) {
                        sells.push({
                            price: parseFloat(body.list.nux_doge.asks[s][0]) || 0,
                            quantity: parseFloat(body.list.nux_doge.asks[s][1]) || 0
                        });
                    }
                } else {
                    for (let b = 0; b < 30; b++) {
                        buys.push({
                            price: parseFloat(body.list.nux_usdt.bids[b][0]) || 0,
                            quantity: parseFloat(body.list.nux_usdt.bids[b][1]) || 0
                        });
                    }

                    for (let s = 0; s < 30; s++) {
                        sells.push({
                            price: parseFloat(body.list.nux_usdt.asks[s][0]) || 0,
                            quantity: parseFloat(body.list.nux_usdt.asks[s][1]) || 0
                        });
                    }
                }


                return cb(null, buys, sells);
            } catch (err) {
                console.log(err);
                return cb(api_error_msg, null, null);
            }
        }
    });
}

function get_chartdata(coin, exchange, api_error_msg, cb) {
    const end = Date.now() / 1000;
    const start = end - 86400;
    const req_url = base_url + '/market/candles/?symbol=' + coin + '_' + exchange + '&from=' + parseInt(start).toString() + '&to=' + parseInt(end).toString() + '&resolution=15';

    // pause for 2 seconds before continuing
    rateLimit.schedule(function () {
        request({ uri: req_url, json: true }, function (error, response, body) {
            if (error)
                return cb(error, null);
            else if (body == null || body == '' || typeof body !== 'object' || typeof body == 'string' || body instanceof String)
                return cb(api_error_msg, null);
            else if (body.error != null)
                return cb((body.error.message != null ? body.error.message : api_error_msg), null);
            else {
                try {
                    let chartdata = [];

                    for (let c = 0; c < body.bars.length; c++) {
                        chartdata.push([
                            parseInt(body.bars[c].time),
                            parseFloat(body.bars[c].open) || 0,
                            parseFloat(body.bars[c].high) || 0,
                            parseFloat(body.bars[c].low) || 0,
                            parseFloat(body.bars[c].close) || 0
                        ]);
                    }

                    return cb(null, chartdata);
                } catch (err) {
                    return cb(api_error_msg, null);
                }
            }
        });
    });
}

module.exports = {
    market_name: 'Qutrade',
    market_logo: 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAMAAAAoLQ9TAAAAAXNSR0IArs4c6QAAAAlwSFlzAAALEwAACxMBAJqcGAAAAGlQTFRFAAAAu5VXxZlW2qZWfnNaf3FZdW1Z26dWkn9X3qlVoIZYu5ZY06NWv5hX3KhW0aFWtpJY36lW4atW5KxWxJpX5q1W46dT0KFW5q1W7rJW0qJX7LBW3alW565W4KpW46xW77JW565W6K5WoM1oYwAAACJ0Uk5TAAQKEBAXGxwkKVVncXiIiJKcoKyxu7rByszS29zl5u/y+BRqlVMAAACMSURBVHjaBcEJgkMwAADAQSuuLt3QA6XJ/x/ZGQAAAADA9W9NaR1rgKLZ4+0W09mB67AUJYSYOxjzWQIexwV9XipVIJRt7hG3QvU6QvudbDOeT+F9Hse5Nl4r5s30bcNnr9lm9LmtWkJQxjTgciyA4pNH6HIMUHiMAXQp/Q/DfW9KgGbaU9rvNQAA+AE6bgiGAtf5/wAAAABJRU5ErkJggg==',
    market_url_template: market_url_template,
    market_url_case: 'l',
    get_data: function (settings, cb) {
        // ensure coin info is lowercase
        settings.coin = settings.coin.toLowerCase();
        settings.exchange = settings.exchange.toLowerCase();

        get_orders(settings.coin, settings.exchange, settings.api_error_msg, function (order_error, buys, sells) {
            if (order_error == null) {
                get_trades(settings.coin, settings.exchange, settings.api_error_msg, function (trade_error, trades) {
                    if (trade_error == null) {
                        get_summary(settings.coin, settings.exchange, settings.api_error_msg, function (summary_error, stats) {
                            if (summary_error == null)
                                return cb(null, { buys: buys, sells: sells, trades: trades, stats: stats, chartdata: null });
                            else
                                return cb(summary_error, null);
                        });
                    } else
                        return cb(trade_error, null);
                });
            } else
                return cb(order_error, null);
        });
    }
};