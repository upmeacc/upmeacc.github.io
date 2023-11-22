const FEE_HIVE = 0.5; // fee in HIVE
const SYMBOL = 'UPME'; // symbol of the token
const ACCOUNT = 'upme.accounts'; // account name of the token

let FEE = 0;
let MARKET = {};
let USER = null;
let USER_BALANCE = {};
const DECIMAL = 1000;

const client = new dhive.Client(['https://hive-api.arcange.eu']);
const ssc = new SSC('https://engine.rishipanthee.com');

// Checking if the already exists
async function checkAccountName (username) {
    try
    {
        let isValid = isValidAccountName(username);
        if (isValid) 
        {
            const ac = await client.database.call('lookup_account_names', [[username]]);
            return (ac[0] === null) ? true : false;
        } 
        else 
        {
            return false;
        }
    }
    catch (error)
    {
        console.log("Error at checkAccountName() : ", error);
        return false;
    }
};

// Creates a suggested password
async function suggestPassword() {
    try
    {
        const array = new Uint32Array(10);
        window.crypto.getRandomValues(array);
        const key = 'UPME000' + dhive.PrivateKey.fromSeed(array).toString();
        return key.substring(0, 25);
    }
    catch (error)
    {
        console.log("Error at suggestPassword() : ", error);
    }
};

// Generates Aall Private Keys from username and password
async function getPrivateKeys(username, password, roles) {
    try
    {
        const privKeys = {};
        roles.forEach((role) => {    
          privKeys[role] = dhive.PrivateKey.fromLogin(username, password, role).toString();    
          privKeys[`${role}Pubkey`] = dhive.PrivateKey.from(privKeys[role]).createPublic().toString();    
        });    
        return privKeys;
    }
    catch (error)
    {
        console.log("Error at getPrivateKeys() : ", error);
    }
};

// get current fee
const getCurrentFee = async () => {
    let calcFee = 0.0;
    try
    {
        const market = await ssc.findOne('market', 'metrics', { symbol: SYMBOL });
        var tokenLastPrice = market.lastPrice;
        tokenLastPrice = parseFloat(tokenLastPrice) || 0.0;
        tokenLastPrice = tokenLastPrice.toFixed(3);
        tokenLastPrice = parseFloat(tokenLastPrice) || 0.0;
      
        var tokenLastDayPrice = market.lastDayPrice;
        tokenLastDayPrice = parseFloat(tokenLastDayPrice) || 0.0;
        tokenLastDayPrice = tokenLastDayPrice.toFixed(3);
        tokenLastDayPrice = parseFloat(tokenLastDayPrice) || 0.0;
      
        var avgPrice = (tokenLastPrice + tokenLastDayPrice) / 2;
        avgPrice = parseFloat(avgPrice) || 0.0;
        avgPrice = avgPrice.toFixed(3);
        avgPrice = parseFloat(avgPrice) || 0.0;
        
        if(avgPrice > 0.0)
        {
          calcFee = FEE_HIVE / avgPrice;
          calcFee = Math.ceil(calcFee * DECIMAL) / DECIMAL;
        }
        return calcFee;
    }
    catch (error)
    {
        console.log("Error at getCurrentFee() : ", error);
        return calcFee;
    }
};

// get market
const getMarket = async () => {
    let price = 0.0, priceInUSD = 0.0;
    try
    {
        //const { data } = await axios.get("https://api.coingecko.com/api/v3/simple/price?ids=hive&vs_currencies=usd");
        const market = await ssc.findOne('market', 'metrics', { symbol: SYMBOL });    
        price = parseFloat(market.lastPrice);
        let hivePrice = await getHiveUSD();
        // calculate price in USD
        priceInUSD = price * hivePrice;
        return { price, priceInUSD };
    }
    catch (error)
    {
        console.log("Error at getMarket() : ", error);
        return { price, priceInUSD };
    }
};

// Check With USD Start Here

async function getHiveUSD () {
    var hiveUSD = 0.0;
    try
    {
        hiveUSD = await getCryptoComparePrice();
        if(hiveUSD <= 0)
        {
            hiveUSD = await getCoinGeckoPrice();
            if(hiveUSD <= 0)
            {
                hiveUSD = await getCoinCapPrice();
                if(hiveUSD <= 0)
                {
                    hiveUSD = await getMessariPrice();
                }
            }
        }
        return hiveUSD;
    }
    catch (error)
    {
        console.log("Error at getHiveUSD() : ", error);
        return hiveUSD;
    }
};
  
async function getCoinGeckoPrice () {
    var hPrice = 0.0;
    try
    {
        const { data } = await axios.get(hiveCoinGeckoAPI);
        hPrice = data.hive.usd;            
        return hPrice;
    }
    catch (error)
    {
        console.log("Error at getCoinGeckoPrice() : ", error);
        return hPrice;
    }
};
  
async function getMessariPrice () {
    var hPrice = 0.0;
    try
    {
        const { data } = await axios.get(hiveMessariAPI);
        hPrice = data.data.market_data.price_usd;            
        return hPrice;
    }
    catch (error)
    {
        console.log("Error at getMessariPrice() : ", error);
        return hPrice;
    }
};
  
async function getCoinCapPrice () {
    var hPrice = 0.0;
    try
    {
        const { data } = await axios.get(hiveCoinCapAPI);
        hPrice = data.data.priceUsd;            
        return hPrice;
    }
    catch (error)
    {
        console.log("Error at getCoinCapPrice() : ", error);
        return hPrice;
    }
};
  
async function getCryptoComparePrice () {
    var hPrice = 0.0;
    try
    {
        const { data } = await axios.get(hiveCryptoCompareAPI);
        hPrice = data.USD;            
        return hPrice;
    }
    catch (error)
    {
        console.log("Error at getCryptoComparePrice() : ", error);
        return hPrice;
    }
};
  
// Check With USD End Here

// get user balance
const getUserBalance = async (account) => {
    let balance = 0;
    let balanceInUSD = 0;
    try
    { 
        const token = await ssc.findOne('tokens', 'balances', { account, symbol: SYMBOL });
        if (token)
        {
            balance = parseFloat(token.balance);
        }
    
        if (MARKET.priceInUSD) 
        {
          balanceInUSD = balance * MARKET.priceInUSD;
        }    
        return { balance, balanceInUSD };
    }
    catch (error)
    {
        console.log("Error at getUserBalance() : ", error);
        return { balance, balanceInUSD };
    }
};

// document ready
$(document).ready(async function () {
    // remove unnessary parameters from url
    window.history.replaceState({}, document.title, "/" + "");

    let isAvail = false;
    // Check if the name is available

    $('#new-account').keyup(async function () {
        const notifyDiv = $('#username-feedback');
        notifyDiv.text('Checking...');

        if ($(this).val().length >= 3) 
        {
          isAvail = await checkAccountName($(this).val());
          let message = (isAvail) ? '<span class="text-success">Username is available.</span> &nbsp;' : '<span class="text-danger">Username is not available.</span> &nbsp;';
          notifyDiv.html(message);
        } 
        else 
        {
          notifyDiv.text('Enter the username you want to create.');
          isAvail = false;
        }
        await createButtonCheck();
    });

    async function createButtonCheck() {
        try
        {
            if (isAvail && $('#password').val().length >= 8) 
            {
                if (USER_BALANCE.balance >= FEE) 
                {    
                    $('#create').prop('disabled', false);    
                    return;    
                }    
            }   
            $('#create').prop('disabled', true);
        }
        catch (error)
        {
            console.log("Error at createButtonCheck() : ", error);
        }
    };

    // Check if the password is valid
    $('#password').keyup(async function () {
        try
        {
            const notifyDiv = $('#password-feedback');
            if ($(this).val().length >= 8) 
            {
                notifyDiv.html('<span class="text-success">Password is valid. Make sure to save this password.</span>');
            } 
            else 
            {
                notifyDiv.text('Password must be at least 8 characters.');
            }
            await createButtonCheck();
        }
        catch (error)
        {
            console.log("Error at keyup() : ", error);
        }      
    });

    // Suggest a password
    $('#password').val(await suggestPassword());

    // refresh password
    $('#genpass').click(async function() {
        try
        {
            let notifyDiv = $('#password-feedback');
            notifyDiv.html('<span class="text-success">Random Generated Password</span>');      
            $('#password').val(await suggestPassword());      
            hackerEffect($('#password'), 'input');
        }
        catch (error)
        {
            console.log("Error at genpass-click() : ", error);
        }
    });

    USER = localStorage.getItem('user');

    let text;
    let isCreationPending = false;

    if (USER)
    {
        $('#username').val(USER);
    }

    async function update () {
        try
        {
            // update price
            MARKET = await getMarket();
            $('#price').text(MARKET.price.toFixed(5) + ' HIVE');
            $('#priceInUSD').text('$' + MARKET.priceInUSD.toFixed(5));

            // update fee
            FEE = await getCurrentFee();
            console.log("FEE : ", FEE);
            $('#fee').text(FEE + ' ' + SYMBOL);
            $('#feeInHive').text('~ ' + FEE_HIVE + ' HIVE');

            // update user balance
            if (USER) 
            {
                USER_BALANCE = await getUserBalance(USER);
                $('#balance').text(USER_BALANCE.balance.toFixed(3) + ' ' + SYMBOL);
                $('#balanceInUSD').text('~ $' + USER_BALANCE.balanceInUSD.toFixed(3));

                if (!isCreationPending)
                {
                    await createButtonCheck();
                }
            }

            // update every 20 seconds
            setTimeout(update, 20000);
        }
        catch (error)
        {
            console.log("Error at update() : ", error);
        }      
    };

    // load user balance
    $('#load-balance').click(async function() {
        $(this).prop('disabled', true);
        USER = $('#username').val();
        localStorage.setItem('user', USER);
        await update();
        $(this).prop('disabled', false);
    });

    await update();    

    // create account
    $('#create').click(async function() {
        // disable button
        $(this).prop('disabled', true);
        $('#new-account').keyup();
        await update();

        if($('#create').prop('disabled') == true)
        {
            return;
        }

        isCreationPending = true;
        let notifyDiv = $('#create-feedback');

        // get username and password
        const username = $('#new-account').val();
        const password = $('#password').val();
        const roles = ['owner', 'active', 'posting', 'memo'];

        // generate keys
        const keys = await getPrivateKeys(username, password, roles);

        // create account with hive keychain
        const message = JSON.stringify({
            account_name: username,
            password
        });

        const keychain = window.hive_keychain;

        if (!keychain) 
        {
            isCreationPending = false;
            $('#create').prop('disabled', false);
            notifyDiv.html('<span class="text-danger">Hive Keychain is not installed.</span>');
            return;
        }

        notifyDiv.html('<span class="text-info">Verify & Transfer through Hive Keychain...</span>');
        
        keychain.requestEncodeMessage(USER, ACCOUNT, '#' + message, 'Memo', (response) => {
            console.log("HERE ENCODE RESPONSE : ", response);
        
            if (!response.success) 
            {
                isCreationPending = false;
                $('#create').prop('disabled', false);
                notifyDiv.html('<span class="text-danger">Failed to encode message.</span>');
                return;
            }

            const encodedMessage = response.result;
            let op = JSON.stringify({
                contractName: 'tokens',
                contractAction: 'transfer',
                contractPayload: {
                    symbol: 'UPME',
                    to: ACCOUNT,
                    quantity: FEE.toFixed(3),
                    memo: encodedMessage
                }
            });

        notifyDiv.html('<span class="text-info">Now Transferring...</span>');

        // create account
        keychain.requestCustomJson(USER, 'ssc-mainnet-hive', 'Active', op,
        'Create Account by Burning UPME', async function(response) {
                console.log(response);

                if (!response.success) 
                {
                    isCreationPending = false;
                    $('#create').prop('disabled', false);
                    notifyDiv.html('<span class="text-danger">Failed to transfer UPME.</span>');
                    return;
                }

                $('#new-username').text(username);
                $('#new-password').text(password);

                // add to view
                roles.forEach(key => {
                    $('#' + key).text(keys[key]);
                    hackerEffect($('#' + key));
                });

                // show #keyscard and slide in from right
                $('#keyscard').removeClass('d-none');
                $('#keyscard').show();

                // notify
                notifyDiv.html('<span class="text-success">Account creation requested successfully!</span>');
            });
        });

        text = `Username: ${username}\n\n`;
        text += `Backup (Master Password): ${password}\n\n`;
        text += `Owner Key: ${keys.owner}\n\n`;
        text += `Active Key: ${keys.active}\n\n`;
        text += `Posting Key: ${keys.posting}\n\n`;
        text += `Memo Key: ${keys.memo}`;
    });

    // copy text
    $('#copy').click(function() {
        const originalText = $(this).html();
        $('#copy').html(`
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-clipboard-check" viewBox="0 0 16 16">
            <path fill-rule="evenodd" d="M10.854 7.146a.5.5 0 0 1 0 .708l-3 3a.5.5 0 0 1-.708 0l-1.5-1.5a.5.5 0 1 1 .708-.708L7.5 9.793l2.646-2.647a.5.5 0 0 1 .708 0z"/>
            <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
            <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
          </svg>
          <span>Copied</span>
        `)
        navigator.clipboard.writeText(text);
        setTimeout(() => {
            $('#copy').html(originalText);
        }, 3000);
    });

    // download text
    $('#download').click(function() {
        const username = $('#new-account').val();
        const downtext = text + `\n\nAccount Created by UPME - acc.uswap.app`;
        const element = document.createElement('a');
        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(downtext));
        element.setAttribute('download', `KEYS - @${username.toUpperCase()}.txt`);
        element.style.display = 'none';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    });

    // css effects
    const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    async function hackerEffect(element, type = 'text') {
        let original = type == 'text' ? element.text() : element.val();
        let iteration = 0;
        let interval = null;
        clearInterval(interval);
        interval = setInterval(() => {
          let text = type == 'text' ? element.text() : element.val();
          const hackerText = text
          .split("")
          .map((letter, index) => {
              if(index < iteration) 
              {
                  return original[index];
              }
              return letters[Math.floor(Math.random() * 62)]
          })
          .join("");
          type == 'text' ? element.text(hackerText) : element.val(hackerText);
          if(iteration >= original.length)
          { 
              clearInterval(interval);
          }
          iteration += 1 / 3;
        }, 30);
    }
    await hackerEffect($('#password'), 'input');
});

// if the account name is valid
async function isValidAccountName(value) {
    if (!value) 
    {
        // Account name should not be empty.
        return false;
    }

    if (typeof value !== 'string') 
    {
        // Account name should be a string.
        return false;
    }

    let len = value.length;

    if (len < 3) {
        // Account name should be longer.
        return false;
    }

    if (len > 16) {
        // Account name should be shorter.
        return false;
    }

    const ref = value.split('.');
    len = ref.length;
    for (let i = 0; i < len; i += 1) 
    {
        const label = ref[i];
        if (label.length < 3) {
            // Each account segment be longer
            return false;
        }

        if (!/^[a-z]/.test(label)) 
        {
            // Each account segment should start with a letter.
            return false;
        }

        if (!/^[a-z0-9-]*$/.test(label)) 
        {
            // Each account segment have only letters, digits, or dashes.
            return false;
        }

        if (/--/.test(label)) 
        {
            // Each account segment have only one dash in a row.
            return false;
        }

        if (!/[a-z0-9]$/.test(label)) {
          // Each account segment end with a letter or digit.
          return false;
        }
    }
    return true;
};
