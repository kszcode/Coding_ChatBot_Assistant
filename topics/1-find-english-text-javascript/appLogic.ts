function registerSEPA_creditCardChange() {

    // Attach the event listener to both tab buttons
    $('#lastschrift-tab, #credit-card-tab, #paypal-tab').on('shown.bs.tab',
        async function (event: JQuery.TriggeredEvent) {
            // Get the id of the current tab
            const activeTabId = (event.target as HTMLElement).id;

            // // extract relatedTarget from event
            // const relatedTarget = (event as EventBase).relatedTarget;
            logThisState("registerSEPA_creditCardChange: activeTabId", activeTabId);

            // Add your logic here when tab changes
            if (activeTabId === 'lastschrift-tab') {
                await initializeStripePaymentForSepa();
            } else if (activeTabId === 'credit-card-tab') {
                await initializeStripePaymentForCreditCard();
            } else if (activeTabId === 'paypal-tab') {
                cpState.paymentType = 'paypal';
            }

        });

}

export async function initializeCheckoutPage(params: any = {}) {

    logThisState("window.initInlineCP: window.epCheckoutParams is called", window.epCheckoutParams);
    // debugger;

    let $email = $('#email');
    if (params?.autofocus) {
        $email.trigger('focus');
    }

    await setCpPageState();
    logThisState("checkout-inline-digital called cpState=", cpState);

    // set window.nextPlanDescription
    if (cpState.afterTrialPlan.planId) {
        window.nextPlanDescription = {
            planId: cpState.afterTrialPlan.planId,
            planPeriod: cpState.afterTrialPlan.planPeriod,
            planPeriodUnit: cpState.afterTrialPlan.planPeriodUnit,
            valueCharge: cpState.afterTrialPlan.planPrice
        }
    } else {
        window.nextPlanDescription = {
            planId: cpState.selectedPlanDescription.planId,
            planPeriod: cpState.selectedPlanDescription.planPeriod,
            planPeriodUnit: cpState.selectedPlanDescription.planPeriodUnit,
            valueCharge: cpState.selectedPlanDescription.planPrice
        }
    }

    logThisState("window.initInlineCP: window.epCheckoutParams", window.epCheckoutParams);
    logThisState("window.initInlineCP: window.epSubs", window.epSubs);

    // debugger;
    const allUrlParams = window.epSubs.getAllUrlParams();
    logThisState("window.initInlineCP: allUrlParams (note: compare with window.extractedURLParams)", allUrlParams);

    // set up the metadata, this is temporarily disabled
    handleCustomFields();

    // await initializeStripePayment();
    registerSEPA_creditCardChange();

    // debugger;
    // let stripePaymentSelected = isStripePaymentSelected();
    // TODO check and fix function isStripePaymentSelected
    let stripePaymentSelected = true;
    // debugger;
    if (stripePaymentSelected) {
        logThisState("window.initInlineCP: isStripePaymentSelected: true with cpState", cpState)
        $('#payment-stripe').show();
        // await initializeStripePaymentForCreditCard();
        await initializeStripePaymentForSepa();
    } else {
        logThisState("window.initInlineCP: isStripePaymentSelected: false with cpState", cpState)
    }


    if (cpState.isLoggedIn) { // debugger;
        // set up customer id
        cpState.customerData.token = allUrlParams.token ? allUrlParams.token : getCookie("epoch_token");
        cpState.customerData.userid = ($ as any).cookie("epoch_user_id");
        // Get user information and check existing subscriptions and payment - updated 2023-03-07
        // debugger;
        await setCustomerDetails();
    } else if (window.epCheckoutParams.email) {
        let email = decodeURIComponent(window.epCheckoutParams.email);
        $email.val(email);
        $email.attr('disabled', 'true');

        // addToAbandonedCartJourney(email);

        if (window.epCheckoutParams.firstname) {
            let firstname = decodeURIComponent(window.epCheckoutParams.firstname);
            $('#customer-fname').val(firstname);
            if (window.epCheckoutParams.lastname) {
                let lastname = decodeURIComponent(window.extractedURLParams.lastname);
                $('#customer-lname').val(lastname);
            }
        }
    }

    // set CC info placeholders
    try {
        $('#zip').mask('0000');
    } catch (e) {
        console.warn("Error setting zip mask: ", e);
    }

    // beautify input on focus loose focus
    let $input = $("input");
    $input.on("focus", function () {
        $(this).addClass("focus");
    });
    $input.on("blur", function () {
        $(this).removeClass("focus");
    });

    // beautify input on input has value, is empty
    $input.on("keyup", function () {
        if ($(this).val()) {
            $(this).removeClass("empty");
            $(this).addClass("val");
        } else {
            $(this).addClass("empty");
            $(this).removeClass("val");
        }
    });

    // configure the validation and submitHandler for the form submission
    initializeFormValidationAndSubmitHandler();

    // using cpState.selectedPlanDescription and window.nextPlanDescription
    // decorate right column with information about subscription
    showPlanDescription();

    try {

        let planData = cpState.selectedPlanDescription.planId;
        planData += (window.epCheckoutParams.cf_plan_after_trial_ends) ? "---" + window.epCheckoutParams.cf_plan_after_trial_ends : "";

        const dataForTracking = {
            "abtest_id": ($ as any).cookie('digital_subscription_tracking_abtest_id') || "",
            "user_id": ($ as any).cookie('epoch_user_id'),
            "category": 'Checkout ' + cpState.selectedPlanDescription.planType + ' Page Loaded',
            "action": planData,
            "label": window.epCheckoutParams.src_cat,
            "src_cat": window.epCheckoutParams.src_cat,
            "src_tmp": window.epCheckoutParams.src_tmp,
            "src_url": window.epCheckoutParams.src_url,
            "src_cmp": window.epCheckoutParams.src_cmp,
            "value": '',
            "metadata": window.checkoutEngineVersion,
            "page": window.location.href,
            "canonical_url": window.epCheckoutParams.src_url,
            "real_url": window.epCheckoutParams.src_url,
            "json_data": JSON.stringify({
                params: window.epCheckoutParams,
                checkoutEngineVersion: window.checkoutEngineVersion
            })
        };

        logThisState("window.initInlineCP: db/senddata: dataForTracking", dataForTracking);
        window.epSubs.trackDataEvent(dataForTracking);
    } catch (e) {

    }

    // set up the capture of user data for each relevant input field
    setupBehaviourTracking();

    logThisState("window.initInlineCP: finished");


}

function isValidEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function handleSubmit(form: HTMLFormElement, event?: JQueryEventObject): Promise<void> {

    if (event) {
        event.preventDefault();
    }

    const $checkoutForm = $('#checkout-form');
    const $submitButton = $checkoutForm.find(':input[type=submit]');
    const $errorHolder = $('.cb-main-footer .error-holder p.error');
    const $email = $('#email');
    const email = $email.val() as string;

    function enableSubmitButton() {
        $submitButton.prop('disabled', false);
    }

    function disableSubmitButton() {
        $submitButton.prop('disabled', true);
    }

    function displayError(message: string) {
        $errorHolder.text(message);
    }

    function handleError(error: string, gaEvent: string) {

        ga('send', 'event', 'Digital Checkout Page', gaEvent);
    }

    disableSubmitButton();
    displayError('');

    ga('send', 'event', 'Digital Checkout Page', 'UX - Submit Clicked');
    cpState.attemptCount++;

    let validEmail = isValidEmail(email);
    if (validEmail) {
        try {
            // debugger;
            logThisState("initializeFormValidationAndSubmitHandler: start checkout if validated by Captcha");
            await grecaptcha.ready(async function () {
                try {
                    const token = await grecaptcha.execute('6LcmJLkZAAAAAMziOnaFrJkOV4ClF_H8OvcqvlyE', {action: 'submit'});
                    displayError('');
                    cpState.recaptchaToken = token;
                    logThisState("initializeFormValidationAndSubmitHandler: calling startCheckout");

                    if (cpState.paymentType === 'stripe-credit') {
                        logThisState("inlineCP:submitHandler: call callStripeCCSubmitHandler");
                        window._cpStripeDict.callStripeCCSubmitHandler();
                    } else if (cpState.paymentType === 'stripe-sepa-payment') {
                        logThisState("inlineCP:submitHandler: call callStripeSepaSubmitHandler");
                        window._cpStripeDict.callStripeSepaSubmitHandler();
                    } else if (cpState.paymentType === 'paypal') {
                        logThisState("inlineCP:submitHandler: call initializedPaypalHandler");
                        initPaypalExpressPayment();
                    } else {
                        logThisState("inlineCP:submitHandler: startCheckout");
                        await startCheckout();
                    }
                } catch (error) {
                    console.error('initializeFormValidationAndSubmitHandler: Error in grecaptcha.execute:', error);
                    enableSubmitButton();
                }
            });
        } catch (e) {
            handleError("initializeFormValidationAndSubmitHandler: exception-327", 'ERROR - startCheckout');
            handleError(`Digital Checkout Page - Error Log: ${e.message}`, 'checkoutpage:startCheckout');
            enableSubmitButton();
        }
    } else {
        $email.after(`<label id="email-error" class="error" for="email">Please enter a valid email address</label>`);
        $email.focus();
        enableSubmitButton();
    }

}

function initializeFormValidationAndSubmitHandler() {
    logThisState("window.initInlineCP: initializeFormValidationAndSubmitHandler: #checkout-form validate called");

    $('#checkout-form').validate({
        rules: {},
        messages: {},
        submitHandler: function (form, event) {


            handleSubmit(form, event).then(r => {
            });
        }
    });

    // logThisState("window.initInlineCP: initializeFormValidationAndSubmitHandler: #checkout-form validate after");

}

function showPlanDescription() {

    let today = window.moment();
    const selectedPlan = cpState.selectedPlanDescription;
    const nextPlan = window.nextPlanDescription;

    const paymentDelay = cpState.selectedPlanDescription.planPeriod + ' ' +
        cpState.selectedPlanDescription.planPeriodUnit +
        (cpState.selectedPlanDescription.planPeriod > 1 ? 's' : '');

    const nextRenewal = today.add(selectedPlan.planPeriod, selectedPlan.planPeriodUnit);
    selectedPlan.planFrequencyString =
        (parseInt(nextPlan.planPeriod) > 1)
            ? (nextPlan.planPeriod + ' ' + nextPlan.planPeriodUnit + 's')
            : nextPlan.planPeriodUnit;

    $('.today-total-value').text(getMoneyString(cpState.offerDetail.content.first_billing_amount));
    // $('.total-gifts-value').text(selectedPlan.giftValueSum);
    // $('.value-digital-sub').text(selectedPlan.valueDigitalSubs);
    // $('.value-total').text(selectedPlan.valueTotal);
    $('.payment-delay-text').text(paymentDelay);
    // $('.gift-without-card-value').text(selectedPlan.giftValueSum - selectedPlan.giftValueGiftCard);
    // $('.value-total-without-giftcard').text(selectedPlan.valueTotal - selectedPlan.giftValueGiftCard);

    if ((selectedPlan.giftValueSum - selectedPlan.giftValueGiftCard) === 0) {
        $(".gift-value-wrapper").hide();
    }

    $('.pre-loader').hide();

    $('.next .price-value').text('$' + getMoneyString(nextPlan.valueCharge));
    $('.next .date-value').text(nextRenewal.format('MMMM Do YYYY'));
    $('.next .frequency-value').text(selectedPlan.planFrequencyString);

    // renderPaypal(selectedPlan.valueCharge);
}


function handleCustomFields() {
    let urlParams = window.epCheckoutParams;


    cpState.checkoutData.meta_data = {
        // "cf_source_landing_page": urlParams.cf_source_landing_page,
        "cf_plan_after_trial_ends": window.epCheckoutParams.cf_plan_after_trial_ends,
        "cf_utm_campaign": urlParams.cf_utm_campaign || window.epCheckoutParams.utm_campaign,
        "cf_utm_source": urlParams.cf_utm_source || window.epCheckoutParams.utm_source,
        "cf_utm_medium": urlParams.cf_utm_medium || window.epCheckoutParams.utm_medium,
        "cf_utm_term": urlParams.cf_utm_term || window.epCheckoutParams.utm_term,
        "cf_utm_content": urlParams.cf_utm_content || window.epCheckoutParams.utm_content,
        "cf_source_page_variant": window.epCheckoutParams.cf_source_page_variant,
        "cf_source_page_url": (window.extractedURLParams.cf_source_page_url) ? window.extractedURLParams.cf_source_page_url.substr(0, 250) : "",
        "cf_impact_clickid": cpState.selectedPlanDescription.planId, // we want this to be always the first active plan
        // "cf_referral_offer": urlParams.cf_referral_offer,
        // "cf_friend_referral": urlParams.cf_friend_referral
    }

    // if there are not any utm parameters in url, we read it from cookies
    try {
        if (!cpState.checkoutData.meta_data.cf_utm_campaign && !cpState.checkoutData.meta_data.cf_utm_source && !cpState.checkoutData.meta_data.cf_utm_medium && !cpState.checkoutData.meta_data.cf_utm_term && !cpState.checkoutData.meta_data.cf_utm_content) {
            cpState.checkoutData.meta_data.cf_utm_campaign = window.epSubs.getVisitorUTMs().utm_campaign;
            cpState.checkoutData.meta_data.cf_utm_source = window.epSubs.getVisitorUTMs().utm_source;
            cpState.checkoutData.meta_data.cf_utm_medium = window.epSubs.getVisitorUTMs().utm_medium;
            cpState.checkoutData.meta_data.cf_utm_term = window.epSubs.getVisitorUTMs().utm_term;
            cpState.checkoutData.meta_data.cf_utm_content = window.epSubs.getVisitorUTMs().utm_content;
        }
    } catch (e) {

    }

    logThisState("handleCustomFields: cpState.checkoutData.meta_data=", cpState.checkoutData.meta_data);

}

/**
 * Get user information and check existing subscriptions and payment
 * @returns {Promise<void>}
 */
export async function setCustomerDetails() {

    // debugger;
    try {
        // debugger;
        let userInfo = await subscriptionAPIs.getUserInformation();
        // debugger;
        logThisState("setCustomerDetails: Got user information", userInfo);

        cpState.customerData.email = userInfo.email;
        let $email = $('#email');
        $email.val(userInfo.email);
        $email.attr('disabled', 'true'); // important to disable to link to a ymk id

        // async call add_abandoned_cart_email with tracking information
        // addToAbandonedCartJourney(cpState.customerData.email);

        // if userInfo contains name, then set the form values
        if (userInfo.name) {
            let nameArr = userInfo.name.split(' ');
            $('#customer-fname').val(nameArr[0]);
            cpState.customerData.firstname = nameArr[0];
            if (nameArr.length > 1) {
                $('#customer-lname').val(nameArr[1]);
                cpState.customerData.lastname = nameArr[1];
            }
        }

        // window.epCheckoutParams is set in public-labs/epoch-ai/et_utils.js:392:
        if (cpState.selectedPlanDescription.planId.indexOf('donation') === -1) {
            // only check if person is buying a digital, not donation plan
            await checkExistingSubs(cpState.customerData.email, async (): Promise<void> => {
                await checkExistingPayment();
                logThisState("setCustomerDetails: after checkExistingPayment cpState.customerData.customer_id", cpState.customerData.customer_id);
            });
        }
    } catch (error) {
        logThisState("setCustomerDetails: generated error", error);
        ga('send', 'event', 'Digital Checkout Page', 'ERROR get user information', JSON.stringify(error));
    }
}


/**
 * Check if there is valid subscription
 * - if there is and it's digital, then show and exit
 * - if there is not then call the handler function which can be:
 *      -  await purchaseSubscription(); // which calls subscriptionAPIs.createSubscriptionUsingOfferAndCreditCard(cpState.recaptchaToken);
 *      or it is
 *      -  await checkExistingPayment(); // which sets cpState.hasExistingPayment flag
 *
 * @param {string} email
 * @param {function} callback  is called if there is no valid subscription
 */
export async function checkExistingSubs(email: string, callback: () => Promise<void>) {
    try {

        // debugger;
        logThisState("checkExistingSubs: for email", email);

        const resSubsInfo = await subscriptionAPIs.getExistingSubsInfo(email);
        // debugger;
        logThisState("checkExistingSubs: got existingSubsInfo", resSubsInfo);

        let hasExistingSubscription = resSubsInfo && resSubsInfo.data && resSubsInfo.data.product_id;

        if (hasExistingSubscription) {
            cpState.customerData.customer_id = resSubsInfo.data.customer_id;
            logThisState("checkExistingSubs: found customer_id", cpState.customerData.customer_id);
        }

        if (cpState.customerData.forced_invalid_subscription) {
            hasExistingSubscription = false;
        }


        if (!hasExistingSubscription) {
            // here it does not have a subscription type
            if (typeof callback == 'function') {
                logThisState("checkExistingSubs: has no valid Data Subscription, or simulated:", cpState.customerData.forced_invalid_subscription);
                callback();
            }
            return;
        }

        const subs_type = resSubsInfo.data.product_id;
        logThisState("checkExistingSubs: has existingSubInfo with subscription_type", subs_type);
        const subs_status = ('' + resSubsInfo.data.subscription_status).toLowerCase();

        // Digital and Video duplication checks
        if (digital_prod_id.includes(cpState.offerDetail.offer_detail.plan.product.id)) {
            if (subs_status === "active"
                && (digital_prod_id.includes(subs_type))) {
                // handle EXISTING digital & print subs
                logThisState("checkExistingSubs: has active existingSubInfo call handleExistingSubscription");
                handleExistingSubscription(subs_type);
                return;
            }

            // logged in possible cases:
            // 1. cancelled subscription
            // 2. payment on file because they bought something else from us
            if (typeof callback == 'function') {
                // not logged in, no active print or digital sub
                callback();
            }
        } else {
            // Bryan added
            if (typeof callback == 'function') {
                // not logged in, no active print or digital sub
                callback();
            }
        }
    } catch (e) {
        console.error("checkExistingSubs: e=", e);
        if (typeof callback == 'function') {
            callback();
        }
        ga('send', 'event', 'Digital Checkout Page', 'ERROR check existing subs info', JSON.stringify(e));
    }
}


export async function checkExistingPayment() {

    if (cpState.customerData.forced_invalid_payment) {
        logThisState("checkExistingPayment: forced to set payment to invalid");
        return;
    }

    if (!cpState.customerData.customer_id) {
        logThisState("checkExistingPayment: does not have an existing customer_id");
        return;
    }

    try {
        logThisState("checkExistingPayment: for cpState.customerData.customer_id", cpState.customerData.customer_id);
        let resPaymentMethod = await subscriptionAPIs.getPaymentMethod();
        logThisState("checkExistingPayment: got payment method", resPaymentMethod);

        if (resPaymentMethod && resPaymentMethod.data && !$.isEmptyObject(resPaymentMethod.data)) {
            logThisState("checkExistingPayment: payment method is set, calling handleExistingPayment " +
                "for resPaymentMethod.data.MaskedNumber", resPaymentMethod.data.MaskedNumber);
            handleExistingPayment(resPaymentMethod.data.MaskedNumber);
            cpState.hasExistingPayment = true;
            logThisState("checkExistingPayment: cpState.hasExistingPayment is set");
            cpState.customerData.customer_id = resPaymentMethod.data.CustomerID;
            logThisState("checkExistingPayment: set customer ID cpState.customerData.customer_id", cpState.customerData.customer_id);
        }
    } catch (error) {
        logThisState("checkExistingPayment: got error", error);
        ga('send', 'event', 'Digital Checkout Page', 'ERROR check existing payment information', JSON.stringify(error));
    }
}

function getStripeKey() {
    // TODO - do an API call to get the stripe key
    let stripeKey = 'pk_live_51HpXGBBkvvoYiDHGJ6bwN8ra8hRMN16nE8QY0I0dMIX7gbaPQd7SV4oTBUKFLAvmPFUgbDLjVjjA9he3Tsa4hGzK00G1nLIwsC'; // de live
    if (window.configUseTestStripe) {
        stripeKey = 'pk_test_51HpXGBBkvvoYiDHGVkmhqveXeGJtvNR0jAVAqDBK7oqTKybcPEFWL17TvMMgdrNOEUVHH7JkDNjQCNnam1zqWacm00O3SvLEmB';
    }
    return stripeKey;
}

async function initializeStripePaymentForSepa() {
    logThisState("initializeStripePaymentForSepa: called");
    cpState.paymentType = 'stripe-sepa-payment';

    let stripe: Stripe | null;

    try {
        stripe = await loadStripe(getStripeKey());
        logThisState("initializeStripePaymentForSepa: Stripe loaded successfully");
    } catch (e) {
        // stripe did not load, fallback to braintree
        // cpState.gateway = 'braintree';
        // $('#payment-using-hosted-field-integration').show();
        // $('#payment-stripe').hide();
        logError("Stripe load error, load braintree instead.", e);
        alert('STRIPE LOAD ERROR!');
        // await initializeBraintreePayment();
        return;
    }

    // Create an instance of Elements
    const elements = stripe.elements();

    // Create an instance of the iban Element
    const iban = elements.create('iban', {
        style: {
            base: {
                fontSize: '16px',
            },
        },
        supportedCountries: ['SEPA'],
    });

    // Add an instance of the iban Element into the `iban-element` <div>
    iban.mount('#iban-element');

    window._cpStripeDict.callStripeSepaSubmitHandler = () => {
        logThisState('callStripeSepaSubmitHandler is called');
        callSepaCreateForStripe(stripe, iban);
    }

    async function callSepaCreateForStripe(stripe: Stripe, iban: StripeIbanElement) {
        extractFormData('#checkout-form');
        logThisState("callSepaCreateForStripe: cpState.inputData", cpState.inputData);

        let $loading = $('.loading-throbber-wrapper');
        try {
            // debugger; // check if iban.value is a string
            const stripeSepaPayload = {
                type: 'sepa_debit',
                currency: 'eur',
                // sepa_debit: {
                //     // iban: 'DE89370400440532013000', // works, but it is hardcoded
                // },
                owner: {
                    name: cpState.inputData.customer_fname + ' ' + cpState.inputData.customer_lname,
                    email: cpState.inputData.email,
                }
            };

            logThisState("callSepaCreateForStripe: stripeSepaPayload", JSON.stringify(stripeSepaPayload));

            const result = await stripe.createSource(iban, stripeSepaPayload);

            // debugger; // check createSource result before passing it on
            if (result.error) {
                // Show error in your UI
                throw new Error(result.error.message);
            }

            // Send PaymentMethod ID to your server
            logThisState("initializeStripePaymentForSepa:stripe.createSource: " +
                "result: ", result);
            // debugger; // check the result before passing it on


            // debugger; // need to check the result before passing it on
            window._cpStripeDict.sepaResponsePayload = result;
            await startCheckout();

        } catch (e) {
            logThisState("initializeStripePaymentForSepa:stripe.createSource:error ", {err: e});
            $loading.fadeOut('fast');
            $('#purchase-btn').prop('disabled', false);
            outputLocalizedText('.error-holder .error', 'checkoutError');
        }
    }

}

async function initializeStripePaymentForCreditCard() {
    logThisState("initializeStripePaymentForCreditCard: called");
    cpState.paymentType = 'stripe-credit';

    let stripe: Stripe | null;

    try {
        stripe = await loadStripe(getStripeKey());
        logThisState("initializeStripePaymentForCreditCard: Stripe loaded successfully");
    } catch (e) {
        // stripe did not load, fallback to braintree
        // cpState.gateway = 'braintree';
        // $('#payment-using-hosted-field-integration').show();
        // $('#payment-stripe').hide();
        logError("Stripe load error, load braintree instead.", e);
        alert('STRIPE LOAD ERROR!');
        // await initializeBraintreePayment();
        return;
    }

    const appearance: Appearance = {
        theme: 'none'
    };
    const elements = stripe.elements({appearance: appearance});

    const styles = {
        base: {
            fontSize: '16pt',
            color: '#3A3A3A',
            '::placeholder': {
                color: '#a9a9a9'
            },
            '::-webkit-input-placeholder': {
                color: '#a9a9a9'
            },
            ':-moz-placeholder': {
                color: '#a9a9a9'
            },
            '::-moz-placeholder': {
                color: '#a9a9a9'
            },
            ':-ms-input-placeholder ': {
//                color: '#bacbca'
                color: '#a9a9a9'
            },
        },
        invalid: {
            color: '#E25950',
        },
        valid: {
            color: 'green'
        }
    }

    const cardNumberElement = elements.create("cardNumber", {style: styles});
    const cardExpiryElement = elements.create("cardExpiry", {style: styles});
    const cardCvvElement = elements.create("cardCvc", {style: styles});
    cardNumberElement.mount("#stripe-card-number");
    cardExpiryElement.mount("#stripe-expiration-date");
    cardCvvElement.mount("#stripe-cvv");

    window._cpStripeDict.callStripeCCSubmitHandler = () => {
        logThisState('callStripeCCSubmitHandler is called with');
        stripeSubmitCreditCardHandler(stripe, cardNumberElement);
    }

    async function stripeSubmitCreditCardHandler(stripe: Stripe, cardNumberElement: StripeCardNumberElement) {
        let $loading = $('.loading-throbber-wrapper');
        try {
            $loading.fadeIn('fast');
            logThisState('cpState:', cpState);
            const billing_zip = $("#billing-zip").val();
            const res = await stripe.createPaymentMethod({
                type: 'card',
                card: cardNumberElement,
                billing_details: {
                    address: {
                        postal_code: (billing_zip as string)
                    }
                }
            });
            if (res && res.error) {
                throw new Error(res.error.message);
            }
            logThisState("window._cpStripeDict.responsePayload is set:", res.paymentMethod);
            window._cpStripeDict.responsePayload = res.paymentMethod;
            await startCheckout();
        } catch (e) {
            $loading.fadeOut('fast');
            $('#purchase-btn').prop('disabled', false);
            outputLocalizedText('.error-holder .error', 'checkoutError');

            logThisState("Stripe error response payload", {err: e});
        }
    }
}

// sfh-split-file-here
async function initPaypalExpressPayment() {
    renderPaypal();
    // TODO: need string translation
    try {
        const expressCheckoutRes = await subscriptionAPIs.setPaypalExpressCheckout('The Epoch Times Digital Subscription');

        const { data } = expressCheckoutRes;
        loadPaypalWindow(data);
    } catch (e) {
        // show error
    }
}

let paypalWin: Window;
async function renderPaypal() {
    paypalWin = window.open("about:blank", "Paypal Checkout Window", 'width=460, height=650');
    
    $(paypalWin.document.body).ready(function() {
        $(paypalWin.document.body).html(paypalLoadingBody);
    });
}

function loadPaypalWindow(billing_token: string) {
    paypalWin.location.href = window.configPaypalUrl + billing_token;

    $(".paypal-checkout-overlay").show();
    $(".paypal-checkout-continue").click(function(event) {
        event.preventDefault();
        event.stopPropagation();
        paypalWin.focus();
    });

    const pollTimer = setInterval(function () {
        if (paypalWin.closed) {
            window.clearInterval(pollTimer);
            $(".paypal-checkout-overlay").hide();
        }

        try {
            const paypalWinUrl = paypalWin && paypalWin.document && paypalWin.document.URL && paypalWin.document.URL;
            if (paypalWinUrl && paypalWinUrl.includes('token=')) {
                window.clearInterval(pollTimer);

                let params = paypalWinUrl.split('?')[1];
                let queryString = new URLSearchParams(params);

                const pToken = queryString.get('token');

                handlePostPaypalLogin(pToken);

                $(".paypal-checkout-overlay").hide();
                paypalWin.close();
            }
        } catch(e) {
            if (!e.message.includes("Permission denied to access property")) {

            }
        }
    }, 100);
}

async function handlePostPaypalLogin(token: string) {
    try {
        const { data } = await subscriptionAPIs.createBillingAgreement(token);
        cpState.paypalPayload.nonce = data;
        const billingAgreementDetails = await subscriptionAPIs.getBillingAgreementDetails(token);
        cpState.paypalPayload.details = billingAgreementDetails.data;

        startCheckout();
    } catch (e) {
        console.error(e);
    }
}

function extractFormData(formElement = '#checkout-form') {
    let formArray = $(formElement).serializeArray();
    let data: any = {};

    formArray.forEach((obj) => {
        let name = obj.name;
        data[name] = obj.value;
    });

    cpState.inputData = data;
}

async function startCheckout() {

    logThisState("startCheckout: called");

    // disable purchase buttons
    let $purchase = $('#purchase-btn');
    $purchase.attr('disabled', 'disabled');
    // show the processing spinner
    let $loading = $('.loading-throbber-wrapper');
    $loading.fadeIn('fast');

    // reset the error message
    let $subscription = $('.subscription-create-error');
    $subscription.text('');
    extractFormData('#checkout-form');
    logThisState("startCheckout: extracted form data cpState.inputData", cpState.inputData);
    logThisState("startCheckout: checking cpState.isLoggedIn", cpState.isLoggedIn);
    logThisState("startCheckout: checking cpState.hasExistingPayment", cpState.hasExistingPayment);

    try {
        // debugger; // L882
        let hasExistingPayment = cpState.isLoggedIn && cpState.hasExistingPayment;
        let hostedFieldIntegration = !$('#payment-using-hosted-field-integration').is(":visible");
        if (hasExistingPayment && hostedFieldIntegration) {
            logThisState("startCheckout: calling purchaseForExistingCustomer");
            await purchaseForExistingCustomer();
        } else {
            logThisState("startCheckout: calling completePurchase");
            await completePurchase();
        }
    } catch (e) {
        logThisState("startCheckout: error received e", e);


        $loading.hide();
        $purchase.removeAttr('disabled');
        $('#checkout-form').find(':input[type=submit]').prop('disabled', false);
        ga('send', 'event', 'Digital Checkout Page', 'ERROR - completePurchase');
        ga('send', 'event', 'Digital Checkout Page - Error Log', 'checkoutpage:completePurchase', e.message);
        $subscription.text('Unable to create subscription, please try again later.');
    }
}

async function completePurchase() {

    // set the email
    let inputData = cpState.inputData;
    let email = cpState.inputData.email || cpState.customerData.email;

    // create the checkoutData object structure for create_subscription API
    cpState.checkoutData.customer = {
        "first_name": inputData.customer_fname,
        "last_name": inputData.customer_lname,
        "email": email,
        // "locale": "en-Au"
    };
    cpState.checkoutData.offer_id = cpState.offerDetail.offer_id;
    cpState.checkoutData.plan = {"id": cpState.offerDetail.content.plan.id};
    cpState.checkoutData.billing = null;
    cpState.checkoutData.shipping = null;


    // debugger; // check the response payload structure, and cpState.paymentType

    // set up the cpState.checkoutData based on the paymentType
    if (cpState.paymentType === 'stripe-credit') {
        logThisState("completePurchase: window._cpStripeDict.responsePayload", window._cpStripeDict.responsePayload);
        let stripeResponse = window._cpStripeDict.responsePayload || {};
        let stripeDetails = stripeResponse.card;

        cpState.checkoutData.payment = {
            // "nonce": 'pm_card_visa',
            "nonce": stripeResponse.id,
            "card_type": stripeDetails.brand.replace(/^\w/, (c: string) => c.toUpperCase()),
            "payment_type": 'CreditCard',
            "last4_digits": stripeDetails.last4,
            "expiration_year": stripeDetails.exp_year.toString(),
            "expiration_month": stripeDetails.exp_month.toString(),
            "zip_code": stripeResponse.billing_details.address.postal_code,
            "gateway": window.configForcePaymentGateway ?
                window.configForcePaymentGateway : cpState.offerDetail.offer_detail.plan.product.default_gateway
        };
    } else if (cpState.paymentType === 'stripe-sepa-payment') {

        logThisState("completePurchase: window._cpStripeDict.sepaResponsePayload",
            window._cpStripeDict.sepaResponsePayload);

        // sampleSepaPayload
        // {
        //   "source": {
        //     "id": "src_1NBikJBkvvoYiDHGJgZX85S1",
        //     "object": "source",
        //     "amount": null,
        //     "client_secret": "src_client_secret_IKl4NBdwwszPG7f8sHHIdf81",
        //     "created": 1685038723,
        //     "currency": "eur",
        //     "flow": "none",
        //     "livemode": false,
        //     "mandate": {
        //       "acceptance": {
        //         "date": null,
        //         "ip": null,
        //         "offline": null,
        //         "online": null,
        //         "status": "pending",
        //         "type": null,
        //         "user_agent": null
        //       },
        //       "amount": null,
        //       "currency": null,
        //       "interval": "variable",
        //       "notification_method": "none",
        //       "reference": "HMH5MGGZXTDPKNQC",
        //       "url": "https://hooks.stripe.com/adapter/sepa_debit/file/src_1NBikJBkvvoYiDHGJgZX85S1/src_client_secret_IKl4NBdwwszPG7f8sHHIdf81"
        //     },
        //     "owner": {
        //       "address": null,
        //       "email": "testIban-1685038719@code4good.men",
        //       "name": "TestIban LN-1685038719",
        //       "phone": null,
        //       "verified_address": null,
        //       "verified_email": null,
        //       "verified_name": null,
        //       "verified_phone": null
        //     },
        //     "sepa_debit": {
        //       "bank_code": "37040044",
        //       "branch_code": null,
        //       "country": "DE",
        //       "fingerprint": "F4eo01CoLsfiIKaG",
        //       "last4": "3000",
        //       "mandate_reference": "HMH5MGGZXTDPKNQC",
        //       "mandate_url": "https://hooks.stripe.com/adapter/sepa_debit/file/src_1NBikJBkvvoYiDHGJgZX85S1/src_client_secret_IKl4NBdwwszPG7f8sHHIdf81"
        //     },
        //     "statement_descriptor": null,
        //     "status": "chargeable",
        //     "type": "sepa_debit",
        //     "usage": "reusable"
        //   }
        // }

        let stripeResponse = (window._cpStripeDict
            && window._cpStripeDict.sepaResponsePayload
            && window._cpStripeDict.sepaResponsePayload.source) || {};
        let stripeDetails = stripeResponse.sepa_debit || {};

        // debugger; // check stripeResponse and stripeDetails

        cpState.checkoutData.payment = {
            "nonce": stripeResponse.id,
            "card_type": stripeResponse.type,
            "payment_type": 'Sepa_Debit',
            "last4_digits": stripeDetails.last4,
            // "zip_code": stripeResponse.billing_details.address.postal_code,
            "gateway": window.configForcePaymentGateway ?
                window.configForcePaymentGateway : cpState.offerDetail.offer_detail.plan.product.default_gateway

        }

    } else if (cpState.paymentType === 'paypal') {
        let payload = cpState.paypalPayload;

        cpState.checkoutData.payment = {
            'payment_type': 'PayPalExpress',
            'nonce': payload.nonce,
            'email': payload.details.EMAIL[0],
            'gateway': window.configForcePaymentGateway ?
                window.configForcePaymentGateway : cpState.offerDetail.offer_detail.plan.product.default_gateway,
            'first_name': payload.details.FIRSTNAME[0],
            'last_name': payload.details.LASTNAME[0],
            'make_primary': true
        }
    }

    // cpState.checkoutData = cpState.checkoutData;
    logThisState("completePurchase: calling checkExistingPayment, cpState.checkoutData=", cpState.checkoutData);
    await checkExistingSubs(email, async function () {
        // debugger;
        logThisState("completePurchase: calling purchaseSubscription");
        await purchaseSubscription();
    });
    logThisState("completePurchase: finished");
}

/**
 * calls create subscription API using the cpState.recaptchaToken
 * ??? where was cpState.recaptchaToken  set
 * ??? isn't that for only single use
 */
async function purchaseSubscription() {

    logThisState("purchaseSubscription: Called with cpState.recaptchaToken", cpState.recaptchaToken);

    try {

        let response = await subscriptionAPIs.createSubscriptionUsingOfferAndCreditCard(cpState.recaptchaToken);

        logThisState("purchaseSubscription: createSubscriptionUsingOfferAndCreditCard called response=", response);

        // if the response contains return_url_for_3ds,
        // Create an iframe and set its source to the url value you extracted from the JSON response.
        // This will open the 3D Secure authentication form within the iframe.
        if (response && response.data && response.data.return_url_for_3ds) {
            logThisState("purchaseSubscription: calling create3DSecureIframe, url=", response.data.return_url_for_3ds);
            response = await create3DSecureIframe(response.data.return_url_for_3ds);
            logThisState("purchaseSubscription: create3DSecureIframe called, new response2=", response);
            // debugger;
        }

        // cpState.newSubData will be used at:
        // - upgradeOffer
        // - startOnboarding
        cpState.newSubData = response.data;
        logThisState("purchaseSubscription: window.newSubsData is set", JSON.stringify(response));
        // debugger;

        if (response && response.data && response.data.token) {
            logThisState("purchaseSubscription: found token in new subscription");
            showSuccessPopup(response.data.token);

            // debugger; // L890
            if (!response.data.sessionid) {
                response.data.sessionid = response.data.session_id;
            }
            if (!response.data.sessionid) {
                response.data.sessionid = window.epSubs.getAllUrlParams().sessionid;
            }
            if (!response.data.sessionid) {
                response.data.sessionid = "set-forcefully-in-purchaseSubscription-DE-202305";
            }
            window.ep.pipaId.refreshCookies(response.data);
            // debugger;

        } else {
            logThisState("purchaseSubscription: there is no token in new subscription, " +
                "OPTIONAL consider if this returned error for some reason");
            showSuccessPopup(false);
        }

        // prepare tracking information
        let planData = cpState.selectedPlanDescription.planId;
        planData += (window.epCheckoutParams.cf_plan_after_trial_ends) ? "--" + window.epCheckoutParams.cf_plan_after_trial_ends : "";

        let safeData = cpState.checkoutData;
        safeData.card = "hidden";

        let conversionEvent = "Conversion Digital Paid Subscription";
        if (cpState.selectedPlanDescription.planType === "video") {
            conversionEvent = "Conversion Video Paid Subscription";
        }
        window.epSubs.trackDataEvent(
            {
                abtest_id: $.cookie('digital_subscription_tracking_abtest_id') || "",
                user_id: $.cookie('epoch_user_id'),
                category: conversionEvent,
                action: planData,
                label: cpState.newSubData.subscription_key,
                "src_cat": window.epCheckoutParams.src_cat,
                "src_tmp": window.epCheckoutParams.src_tmp,
                "src_url": window.epCheckoutParams.src_url,
                "src_cmp": window.epCheckoutParams.src_cmp,
                metadata: window.checkoutEngineVersion,
                page: window.location.href,
                real_url: window.epCheckoutParams.src_url,
                canonical_url: window.epCheckoutParams.src_url,
                value: cpState.offerDetail.offer_detail.plan.price,
                json_data: JSON.stringify({
                    subsData: cpState.newSubData,
                    params: window.epCheckoutParams,
                    checkoutData: safeData,
                    email: safeData.customer.email,
                }),
            }
        );
        window.epSubs.trackGAEvent(
            "paywall:Conversion Paid Subscription",
            planData,
            cpState.newSubData.subscription_key,
        );
        window.epSubs.trackGAEvent(
            "paywall:Checkout Process",
            "Checkout Success",
        );
        window.epSubs.trackGAPageview(
            "/virtual/goals/paid-subscription/" + planData + "/" + cpState.newSubData.subscription_key,
        );

    } catch (err) {
        logThisState("purchaseSubscription: caught an error", err);
        $('.loading-throbber-wrapper').hide();
        $('#purchase-btn').show();
        $('#checkout-form').find(':input[type=submit]').prop('disabled', false);
        let res = err.responseText,
            statusText = err.statusText,
            errorMsgKey = '';

        if (statusText && statusText === "Bad Gateway") {
            outputLocalizedText('.subscription-create-error', 'checkoutError');
            ga('send', 'event', 'Digital Checkout Page', 'errlog:purchaseSubscription', 'Unable to checkout, please verify that your payment details are correct.');
        } else if (res) {
            if (res.includes('AVS check failed')) {
                errorMsgKey = 'subscriptionPurchaseError';
            } else if (res.includes('Prepaid cards are not supported')) {
                errorMsgKey = 'prepaidCardError';
            } else {
                errorMsgKey = 'checkoutErrorWithSupport';
            }
            outputLocalizedText('.subscription-create-error', errorMsgKey);
            ga('send', 'event', 'Digital Checkout Page', 'errlog:purchaseSubscription', err.responseText);
        } else {
            outputLocalizedText('.subscription-create-error', 'checkoutError');
            ga('send', 'event', 'Digital Checkout Page', 'errlog:purchaseSubscription', 'Unable to checkout, please verify that your payment details are correct.');
        }
    }
}

// interface ThreeDSecureResponse {
//     status: string;
// }

// interface Create3DSecureIframeOptions {
//     onError?: (error: Error) => void;
//     timeout?: number;
// }

/**
 * @param returnUrlFor3DS
 * sample: https://hooks.stripe.com/3d_secure_2/hosted?merchant=acct_1HpXGBBkvvoYiDHG&publishable_key=pk_test_...
 */
function create3DSecureIframe(
    returnUrlFor3DS: string
): Promise<string> {
    const timeout = 30 * 60 * 1000; // 30 minutes, after this time the iframe will be closed.
    logThisState("create3DSecureIframe: called, returnUrlFor3DS=", returnUrlFor3DS);

    return new Promise((resolve, reject) => {
        // Create an iframe for 3D Secure authentication.
        const iframe = document.createElement('iframe');
        iframe.src = returnUrlFor3DS;
        iframe.id = 'stripe-3ds-iframe-fullscreen';
        iframe.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 9999; border: none`;
        document.body.appendChild(iframe);

        // Set a timer for handling timeouts.
        const timer = setTimeout(() => {
            removeIframeAndListener();
            handleError(new Error('3D Secure authentication timed out.'));
        }, timeout);

        // Listen for localizedMessages from the iframe.
        window.addEventListener('message', messageHandler);

        // Handle the received message from the iframe.
        function messageHandler(event: MessageEvent) {

            try {

                logThisState("messageHandler: message from Stripe received, event=", JSON.stringify(event));

                // Add the allowed origins for Stripe events in an array
                const allowedOrigins = [
                    "https://hooks.stripe.com",
                    "https://testmode-acs.stripe.com",
                    "https://ds-etd-static.test",
                    "https://static.epochtimes.de",
                ];

                if (!allowedOrigins.includes(event.origin)) {
                    logThisState("messageHandler: message from Stripe received, but origin is not expected" +
                        " expectedOrigins: " + JSON.stringify(allowedOrigins) +
                        " eventOrigin: " + event.origin);
                    return;
                }

                // debugger; // check subscriptionJsonData
                if (!event) return;
                const eventData = event.data;
                logThisState("messageHandler: message from Stripe received, event.data=", eventData);

                if (!eventData) return;
                // if eventData does not start with subscriptionKey=, then return
                if (!("" + eventData).startsWith("subscriptionJsonData=")) return;
                // "subscriptionJsonData={\"status\":\"subscription\",\"data\":{\"subscription_key\":\"SRtgNfxSDhekhS7cqag5==\",\"token\":\"\"}}"

                // extract the subscriptionJsonData from eventData
                const subscriptionJsonData = ("" + eventData).replace("subscriptionJsonData=", "");
                logThisState("messageHandler: message from Stripe received, subscriptionJsonData=", subscriptionJsonData);
                if (subscriptionJsonData === "rejected") {
                    removeIframeAndListener();
                    handleError(new Error('Payment failed.'));
                }

                // debugger; // L1057
                const subscriptionJsonDataObj = JSON.parse(subscriptionJsonData);
                logThisState("messageHandler: message from Stripe received, subscriptionJsonDataObj=", subscriptionJsonDataObj);

                clearTimeout(timer);
                logThisState("messageHandler: clearTimeout called to remove the timer");

                removeIframeAndListener();
                logThisState("messageHandler: removeIframeAndListener called to remove the iframe and listener");

                // debugger; // check what happens on resolve
                resolve(subscriptionJsonDataObj);

                // logThisState("messageHandler: eventData.status is not 'success', handling error with eventData.status:", eventData.status);
                // handleError(new Error(`3D Secure authentication failed or was canceled. Status: ${eventData.status}`));

            } catch (error) {
                // debugger;
                logThisState("messageHandler: error=", error);
                handleError(new Error(`3D Secure authentication failed or was canceled. Status: ${event}`));
                return;
            }
        }

        // Remove the iframe and event listener.
        function removeIframeAndListener() {
            logThisState("messageHandler: removeIframeAndListener");
            window.removeEventListener('message', messageHandler);
            document.body.removeChild(iframe);
        }

        // Handle errors.
        function handleError(error: Error) {
            logThisState("messageHandler: handleError called, error=", error);
            reject(error);
        }
    });
}


async function purchaseForExistingCustomer() {

    logThisState("purchaseForExistingCustomer: is called!");

    try {
        cpState.existingSubData = await subscriptionAPIs.createSubsForExistingCustomer();
        logThisState("purchaseForExistingCustomer subscriptionAPIs.createSubsForExistingCustomer() result:", cpState.existingSubData);


        showSuccessPopup(false);

        try {
            let planData = cpState.selectedPlanDescription.planId;
            planData += (window.epCheckoutParams.cf_plan_after_trial_ends) ? "--" + window.epCheckoutParams.cf_plan_after_trial_ends : "";

            let conversionEvent = "Conversion Digital Paid Subscription";
            if (cpState.selectedPlanDescription.planType === "video") {
                conversionEvent = "Conversion Video Paid Subscription";
            }
            window.epSubs.trackDataEvent(
                {
                    abtest_id: $.cookie('digital_subscription_tracking_abtest_id') || "",
                    user_id: $.cookie('epoch_user_id'),
                    category: conversionEvent,
                    action: planData,
                    label: "",
                    "src_cat": window.epCheckoutParams.src_cat,
                    "src_tmp": window.epCheckoutParams.src_tmp,
                    "src_url": window.epCheckoutParams.src_url,
                    "src_cmp": window.epCheckoutParams.src_cmp,
                    metadata: window.checkoutEngineVersion,
                    // page: window.location.href,
                    real_url: window.epCheckoutParams.src_url,
                    canonical_url: window.epCheckoutParams.src_url,
                    page: window.epCheckoutParams.src_url,
                    json_data: JSON.stringify({
                        subsData: cpState.existingSubData,
                        params: window.epCheckoutParams,
                        // checkoutData: safeData,
                        // email: safeData.customer.email,
                    }),
                }
            );
            window.epSubs.trackGAEvent(
                "paywall:Conversion Paid Subscription",
                planData,
                cpState.existingSubData.subscription_key,
            );
            window.epSubs.trackGAEvent(
                "paywall:Checkout Process",
                "Checkout Success",
            );
            window.epSubs.trackGAPageview(
                "/virtual/goals/paid-subscription/" + planData + "/" + cpState.existingSubData.subscription_key,
            );
        } catch (e) {

        }
    } catch (response) {

        $('.loading-throbber-wrapper').hide();
        $('#purchase-btn').show();
        $('#checkout-form').find(':input[type=submit]').prop('disabled', false);

        // $('.existing-subscription-create-error').text('Unable to checkout, please try logging out or contacting our customer service.');
        outputLocalizedText('.existing-subscription-create-error', 'checkoutErrorLogoutOrContact');
        ga('send', 'event', 'Digital Checkout Page', 'errlog:purchaseSubscriptionExistingCustomer', JSON.stringify(response));
    }
}


function showSuccessPopup(newUserToken: string | boolean) {

    // debugger;

    // Execute all success callbacks

    if (window.callbackCheckoutSuccess && window.callbackCheckoutSuccess.length > 0) {
        for (let idx in window.callbackCheckoutSuccess) {
            if (typeof window.callbackCheckoutSuccess[idx] == "function") {
                try {
                    window.callbackCheckoutSuccess[idx]();
                } catch (e) {

                }
            }
        }
    }


    // debugger;

    let $successPopup = $('#successPopup');
    $successPopup.appendTo('body');
    $('.loading-throbber-wrapper').hide();
    $('#purchase-btn').show();
    $successPopup.modal('show');

    setCookie('epoch_subscribed', cpState.selectedPlanDescription.planId, 1);

    $('#continue-reading, .continue-reading').on('click',
        function (e) {
            continueReadingRedirect();
        });

    trackReferralInfo();

    // debugger;
    logThisState("showSuccessPopup: newUserToken=", newUserToken);
    logThisState("showSuccessPopup: cpState.customerData.token=", cpState.customerData.token);
    logThisState("showSuccessPopup: cpState.isLoggedIn=", cpState.isLoggedIn);
    logThisState("showSuccessPopup: cpState=", cpState);

    // debugger; // L1215
    if (cpState.isLoggedIn || !newUserToken) { // debugger;
        let $setpw = $('#setpw-form #ymkpassword');
        $setpw.hide();
        $setpw.removeAttr('required');
        $('#setpw-form').on('submit', function (e) {
            // debugger;
            e.preventDefault();
            handleSurveySubmit(cpState.customerData.token);
            return false;
        });
    } else {
        // debugger; // L1232
        $('#ymkpassword').trigger('focus');
        $('#setpw-form').on('submit', function (e) {
            e.preventDefault();
            handlePasswordChange(newUserToken as string);
            return false;
        });
    }
}

function continueReadingRedirect() {
    logThisState("continueReadingRedirect: called");
    if (window.epCheckoutParams.return_url) {
        let url = window.epCheckoutParams.return_url;
        if (url.substr(0, 1) === "/") {
            url = "https://theepochtimes.com" + url;
        }
        window.location.replace(url);
    } else if (window.extractedURLParams.cf_source_page_url) {
        let url = decodeURIComponent(window.extractedURLParams.cf_source_page_url);
        if (url.includes('www.theepochtimes.com')) {
            if (cpState.selectedPlanDescription.planType === "video") {
                window.location.replace('https://www.theepochtimes.com/epochtv');
            } else {
                window.location.replace('https://www.theepochtimes.com/');
            }
        } else {
            window.location.replace('https://www.theepochtimes.com/');
        }
    } else {
        if (cpState.selectedPlanDescription.planType == "video") {
            window.location.replace('https://www.theepochtimes.com/epochtv');
        } else {
            window.location.replace('https://www.theepochtimes.com/');
        }
    }
}

function validatePassword(userInput: string) {
    let requirements = /(?=.{5,32}).*/;
    return requirements.test(userInput);
}

async function handlePasswordChange(newUserToken: string) {
    let password = $('#setpw-form #ymkpassword').val(),
        data = {
            password: password,
            confirmpassword: password
        };

    // validation stuff
    const form = $('#setpw-form');
    form.removeClass('was-validated');

    $("#setpw-form input").each(function () {
        $(this).removeClass("is-invalid");
    });

    if (!validatePassword(($("#ymkpassword", form).val() as string))) {
        $("#ymkpassword", form).addClass("is-invalid");
        $("#ymkpassword", form)[0].scrollIntoView();
        return;
    }
    // end

    try {
        await subscriptionAPIs.changePassword(data, newUserToken);
    } catch (error) {
        ga('send', 'event', 'Digital Checkout Page', 'Unsuccessful password update', error);
    } finally {
        handleSurveySubmit(newUserToken);
    }
}

// sfh-split-file-here

async function handleSurveySubmit(token: string) {
    let siteId = window.configSiteID;
    // debugger; // inside handleSurveySubmit

    // validation
    const form = $('#setpw-form');
    form.removeClass('was-validated');

    $("#setpw-form input").each(function () {
        $(this).removeClass("is-invalid");
    });

    if (!$('#success_survey_answer').val()) {
        $("#success_survey_answer", form).addClass("is-invalid");
        $("#success_survey_answer", form)[0].scrollIntoView();
        return;
    }
    // end

    $('#setpw-form #create-password-btn').hide();
    $('#setpw-form .loading-throbber-wrapper').fadeIn('fast');

    try {

        // debugger; // inside try block
        let surveyResponse = $('#success_survey_answer').val(),
            surveyData = {
                'response': surveyResponse
            },
            data = {
                site: siteId,
                email: $('#email').val(),
                survey: JSON.stringify(surveyData)
            };


        // debugger; // send results to aitest.youmaker.com
        await $.ajax({
            method: "POST",
            type: "POST",
            url: `https://aitest.youmaker.com/survey/save?token=${token}`,
            contentType: "application/json",
            dataType: "json",
            data: JSON.stringify(data),
            success: function (response) {

                return;
            },
            error: function (response) {

                return;
            }
        });

    } catch (e) {
        ga('send', 'event', 'Digital Checkout Page', 'Unsuccessful survey response send', e);
    } finally {
        try {
            let fields = {
                subscription_key: cpState.newSubData && cpState.newSubData.subscription_key,
                answer: $('#success_survey_answer').val()
            }

            // debugger; // do this in finally level 1
            let urlSaveChannelSource = window.configConductorUrl + 'save_referrer_sub_channels' + `?site_id=${siteId}`;
            logThisState("handleSurveySubmit: urlSaveChannelSource=" + urlSaveChannelSource + " fields=", JSON.stringify(fields));

            // make an ajax call with form data from fields
            await $.ajax({
                method: "POST",
                type: "POST",
                url: urlSaveChannelSource,
                contentType: "application/json",
                dataType: "json",
                data: JSON.stringify(fields),
                success: function (response) {
                    logThisState('handleSurveySubmit: send survey response success: ', response);
                    handleSuccessPageRedirect();
                },
                error: function (response) {
                    logThisState('handleSurveySubmit: send survey response fail: ', response);
                    handleSuccessPageRedirect();
                }
            });

            // handleSuccessPageRedirect();
        } catch (e) {
            ga('send', 'event', 'Print Checkout Page', 'Unsuccessful survey response send', e);
            // handleSuccessPageRedirect();
        } finally {
            // debugger; // do this in finally level 2
            if (typeof window.actionAfterThankYou == "function") {
                try {
                    // debugger; // before window.actionAfterThankYou();
                    window.actionAfterThankYou();
                } catch (e) {
                    // debugger; // in catch
                    continueReadingRedirect();
                }
            } else {
                // debugger; // continue in else
                continueReadingRedirect();
            }
        }
    }
}

function handleSuccessPageRedirect() {
    top.window.location.href = "https://dev-profile.epochtimes.de/de/?start=on-boarding";
}

/**
 * set up the capture of user data for each relevant input field
 */
function setupBehaviourTracking() {
    window.fieldBackup = {}

    // when email is filled out, we call an async operation to check how valid that email is
    // if it is valid then we start a purchase cart jouney, so we can remind people to check back
    $('#checkout-form [name="email"]').focusout(() => {
        // captureCheckoutEvent('1. email field completed', '#checkout-form [name="email"]');
        let email = $('#checkout-form [name="email"]').val() || "";
        $.ajax({
            type: "POST",
            url: "https://subscribe.theepochtimes.com/api/email.php?action=verify",
            data: {
                email: email,
                emailoversight: false
            },
            dataType: 'json',
            success: function (response) {
                logThisState("setupBehaviourTracking: success verifying email: " + email + ", got response", response)
                if (response.valid) {
                    // TODO this seems to be called rather often here
                    // debugger;
                    // addToAbandonedCartJourney(email as string);
                }
            },
            error: function (response) {
                logThisState("setupBehaviourTracking: error verifying email: " + email + ", got response", response)
            }
        });
    });

    // capture user events on a timeout if during that timeout the value does not change, so we don't overload the server
    // $('#checkout-form [name="customer_fname"]').focusout(() => {
    //     captureCheckoutEvent('3. first name field completed', '#checkout-form [name="customer_fname"]')
    // });
    // $('#checkout-form [name="customer_lname"]').focusout(() => {
    //     captureCheckoutEvent('4. last name field completed', '#checkout-form [name="customer_lname"]')
    // });
    // $('#checkout-form [name="zip"]').focusout(() => {
    //     captureCheckoutEvent('9. zip field completed', '#checkout-form [name="zip"]')
    // });
    // $('#checkout-form [name="card_number"]').focusout(() => {
    //     captureCheckoutEvent('10. card field completed', '#checkout-form [name="card_number"]')
    // });
    // $('#checkout-form [name="expiry"]').focusout(() => {
    //     captureCheckoutEvent('11. expiry field completed', '#checkout-form [name="expiry"]')
    // });
    // $('#checkout-form [name="cvv"]').focusout(() => {
    //     captureCheckoutEvent('12. cvv field completed', '#checkout-form [name="cvv"]')
    // });

}

window.UpgradeOffer = {
    start: function () {
        // debugger; // inside start
        const forceOnboarding = true;
        if (forceOnboarding) {

            this.startOnboarding();
            return;
        }
        let subs_id = false;
        if (cpState.newSubData && cpState.newSubData.subscription_key) {
            subs_id = cpState.newSubData.subscription_key;
        } else if (cpState.existingSubData && cpState.existingSubData.subscription_key) {
            subs_id = cpState.existingSubData.subscription_key;
        }

        if ((cpState.selectedPlanDescription.planType === "video" || cpState.selectedPlanDescription.planType === "digital")
            && cpState.selectedPlanDescription.planPeriodUnit !== "year" && subs_id) {
            // Register hook for final redirect
            window.addEventListener("message", function (message) {
                try {
                    let data = JSON.parse(message.data);
                    if (data.module === "CHECKOUT" && data.action === "REDIRECT") {
                        continueReadingRedirect();
                    }
                } catch (e) {
                }
            }, false);

            let upgradeTemplateId = "e1d7892d-5878-41e3-9c21-fd856153f027";
            if (cpState.selectedPlanDescription.planType === "video") {
                upgradeTemplateId = "e8fa5618-82f9-4954-a3dc-65b845873e54";
            }

            $('.thankyou-simple').remove();
            window.parent.postMessage(JSON.stringify({
                module: "GENERAL",
                action: "POPUP",
                data: {
                    width: "800px",
                    height: "650px",
                    hideCloseBtn: true,
                    template: {
                        id: upgradeTemplateId,
                        data: {
                            subscription_key: subs_id,
                            sourceTemplate: window.checkoutEngineVersion,
                            originalPlan: cpState.selectedPlanDescription.planId
                        }
                    },
                }
            }), "*");


        } else {
            continueReadingRedirect();
            return;
        }
    },

    startOnboarding: function (subs_id: string) {

        // debugger; // inside startOnboarding
        if (cpState.newSubData && cpState.newSubData.subscription_key) {
            subs_id = cpState.newSubData.subscription_key;
        } else if (cpState.existingSubData && cpState.existingSubData.subscription_key) {
            subs_id = cpState.existingSubData.subscription_key;
        } else {
            subs_id = subs_id ? subs_id : '';
        }
        let subs_email = (cpState.checkoutData.customer && cpState.checkoutData.customer.email) || cpState.customerData.email;

        // return;

        // VIDEO non-yearly sub
        if (cpState.selectedPlanDescription.planType === "video" && cpState.selectedPlanDescription.planPeriodUnit !== "year" && subs_id) {
            window.addEventListener("message", function (message) {
                try {
                    let data = JSON.parse(message.data);
                    if (data.module === "CHECKOUT" && data.action === "REDIRECT") {
                        continueReadingRedirect();
                    }
                } catch (e) {
                }
            }, false);
            $('.thankyou-simple').remove();
            window.parent.postMessage(JSON.stringify({
                module: "GENERAL",
                action: "POPUP",
                data: {
                    width: "800px",
                    height: "650px",
                    hideCloseBtn: true,
                    template: {
                        id: "e8fa5618-82f9-4954-a3dc-65b845873e54",
                        data: {
                            subscription_key: subs_id,
                            sourceTemplate: window.checkoutEngineVersion,
                            originalPlan: cpState.selectedPlanDescription.planId
                        }
                    },
                }
            }), "*");
        } else if (cpState.selectedPlanDescription.planType === "digital" && subs_id) {

            // DIGITAL sub
            window.addEventListener("message", function (message) {

                try {
                    let data = JSON.parse(message.data);
                    if (data.module === "CHECKOUT" && data.action === "REDIRECT") {

                        // return;
                        continueReadingRedirect();
                    }
                } catch (e) {
                    console.error("startOnboarding: event listener error L1635", e);
                }
            }, false);

            // https://subs.epochbase.eu/lib/api.bundle.js?execute=false&track=false&useSameDomain=true
            let templateParameters = {
                subscription_key: subs_id,
                sourceTemplate: window.checkoutEngineVersion,
                originalPlan: cpState.selectedPlanDescription.planId,
                // offerAnnualUpgrade: (cpState.selectedPlanDescription.planPeriodUnit !== "year") ? true : false,
                offerAnnualUpgrade: false,
                userEmail: subs_email,
                defaultLists: "XvIFJS6Zcw",
                digital: true,
                planType: cpState.selectedPlanDescription.planType,
            };
            // debugger; // look into showTemplate
            window.epSubs.showTemplate("80158ba8-d2f1-4dec-834b-0b8c7f694fd0", 'POPUP', {
                height: "100%",
                width: "100%",
                hideCloseBtn: true,
                version: 1
                // version: (Math.random() > 0.4) ? 3 : 1
            }, templateParameters);

        } else {

                cpState.selectedPlanDescription.planType,
                " subs_id: ", subs_id);
            window.addEventListener("message", function (message) {

            });

            continueReadingRedirect();
            return;
        }
    }
}

async function getEmailSecureToken(email: string) {
    return $.ajax({
        method: 'GET',
        url: 'https://subsapi.epoch.cloud/get_email_secure_token?days_expire=30&email=' + encodeURIComponent(email),
        dataType: 'json'
    });
}

function trackReferralInfo() {
    try {
        let st = window.epSubs.getAllUrlParams(window.epSubs.getAllUrlParams().pl).st;
        if (st && cpState.checkoutData && cpState.checkoutData.customer && cpState.checkoutData.customer.email) {

            $.ajax({
                url: 'https://subsapi.epoch.cloud/referral/accept?referral_type=digital&share_token=' + encodeURIComponent(st) + '&email=' + encodeURIComponent(cpState.checkoutData.customer.email),
                dataType: 'json',
                method: 'GET',
            })
        }
    } catch (e) {

    }
}

export const subscriptionAPIs = {
    conductorHostUrl: window.configConductorUrl,
    userHostUrl: window.configUserHostUrl,
    siteID: window.configSiteID,


    registerUser: async function (data: any) {
        return $.ajax({
            type: "POST",
            url: this.userHostUrl + "registration?site=" + this.siteID,
            data: JSON.stringify(data),
            contentType: 'application/json',
            dataType: 'json',
            success: function (res) {
                ga('send', 'event', 'Digital Checkout Page', 'Create user success', JSON.stringify(res));
            },
            error: function (res) {
                ga('send', 'event', 'Digital Checkout Page', 'Create user failure', JSON.stringify(res));
            }
        });
    },

    getUserInformation: async function () {
        // debugger;
        let url = this.userHostUrl + "info?token=" + cpState.customerData.token;
        return $.ajax({
            type: "GET",
            url: url,
            success: function (res) {
                // debugger;
                ga('send', 'event', 'Digital Checkout Page', 'Get user information success', JSON.stringify(res));
            },
            error: function (res) {
                // debugger;
                ga('send', 'event', 'Digital Checkout Page', 'Get user information failure', JSON.stringify(res));
            }
        });
    },

    getPaymentMethod: async function () {
        // debugger;
        let urlListCards = this.conductorHostUrl + "list_card?token=" + cpState.customerData.token
            + "&customer_id=" + cpState.customerData.customer_id
            + "&site_id=" + this.siteID;
        logThisState("getPaymentMethod: urlListCards=", urlListCards);
        return $.ajax({
            type: "GET",
            url: urlListCards,
            contentType: 'application/json',
            dataType: "json",
            success: function (res) {
                logThisState("getPaymentMethod: Get payment list success!", JSON.stringify(res));
                ga('send', 'event', 'Digital Checkout Page', 'Get payment information success', JSON.stringify(res));
            },
            error: function (res) {
                $('#payment-card .edit-subs-btn').hide();
                ga('send', 'event', 'Digital Checkout Page', 'Get payment information failure', JSON.stringify(res));
            }
        });
    },

    getPlanDetails: function (plan_id: string) {
        return $.ajax({
            url: `${this.conductorHostUrl}retrieve_plan?siteid=${this.siteID}&planid=${plan_id}`,
            method: "GET",
            contentType: 'application/json',
            dataType: "json",
            success: function (res) {

                if (res.status === 'ok') {
                    ga('send', 'event', 'Digital Checkout Page', 'Get plan information success', JSON.stringify(res));
                    return res.data;
                }
            },
            error: function (res) {
                ga('send', 'event', 'Digital Checkout Page', 'Get plan information failure', JSON.stringify(res));
                $('#purchase-btn').attr('disabled', 'disabled');
            }
        });
    },

    // This will fetch marketing localizedMessages realted to plan
    getPlanDescription: function (plan_id: string) {

        return $.ajax({
            url: 'https://subscribe.theepochtimes.com/api/productdescription.php?plan_id=' + plan_id,
            method: "GET",
            contentType: 'application/json',
            dataType: "json",
            success: function (res) {

                return res;
            },
            error: function (res) {

                return {}
            }
        })

    },

    getExistingSubsInfo: async function (email: string) {

        const url = `${this.conductorHostUrl}get_subsid?email=${encodeURIComponent(email)}&site_id=${this.siteID}`;
        return $.ajax({
            url: url,
            method: "GET",
            contentType: 'application/json',
            dataType: "json",
            success: function (response) {

            },
            error: function (response) {
                console.error("getExistingSubsInfo: url=", url);
                console.error("getExistingSubsInfo: response=", response);
            }
        });
    },

    changePassword: function (data: any, newUserToken: string) {
        return $.ajax({
            type: "POST",
            url: window.configUserHostUrl + `changepassword?token=${encodeURIComponent(newUserToken)}&site_id=${this.siteID}`,
            data: data,
            dataType: "json",
            success: function (res) {

                if (res.status === "ok") {
                    ga('send', 'event', 'Digital Checkout Page', 'Successful password update', cpState.customerData.userid);
                } else {
                    ga('send', 'event', 'Digital Checkout Page', 'Unsuccessful password update', cpState.customerData.userid + ', error: ' + res);
                }
            },
            error: function (res) {

                ga('send', 'event', 'Digital Checkout Page', 'Unsuccessful password update', cpState.customerData.userid + ', error: ' + res);
            }
        });
    },

    requestResetPassword: function (email: string) {
        const reseturl = 'https://www.theepochtimes.com?pipa_reset_password=';

        return $.ajax({
            url: `${this.userHostUrl}resetpassword?site=${this.siteID}&email=${encodeURIComponent(email)}&reseturl=${reseturl}`,
            method: "POST",
            contentType: 'application/json',
            dataType: 'json',
            success: function (res) {

            },
            error: function (error) {

            }
        })
    },

    createSubscriptionUsingOfferAndCreditCard: function (recaptchaToken: string) {

        logThisState("createSubscriptionUsingOfferAndCreditCard: cpState.checkoutData=", cpState.checkoutData);

        // activate test functions
        const injectionValue = $.cookie('test-sample-injection');
        const injectionParameter = injectionValue ? `&injectionCommand=${injectionValue}` : '';

        const hostNameFor3DS = window.location.hostname;

        //  `${this.conductorHostUrl}create_subscription_using_offer?site_id=${this.siteID}${injectionParameter}&recaptcha=${recaptchaToken}`,
        let apiUrl = `${this.conductorHostUrl}create_subscription_using_offer`;
        apiUrl += `?site_id=${this.siteID}`;
        apiUrl += `&hostNameFor3DS=${hostNameFor3DS}`;
        apiUrl += `${injectionParameter}`;
        apiUrl += `&recaptcha=${recaptchaToken}`;

        logThisState("createSubscriptionUsingOfferAndCreditCard: apiUrl=", apiUrl);

        return $.ajax({
            url: apiUrl,
            // url: `https://subsapi-dev.epoch.cloud/chargebee/create_subscription?siteid=${this.siteID}&recaptcha=${cpState.recaptchaToken}`,
            method: "POST",
            type: "POST",
            contentType: "application/json",
            dataType: "json",
            data: JSON.stringify(cpState.checkoutData),
            success: function (res) {

                if (res.status === 'ok') {
                    ga('send', 'event', 'Digital Checkout Page', 'SUCCESS - purchaseSubscription');
                } else {
                    try {
                        window.epSubs.trackDataEvent({
                            "abtest_id": ($ as any).cookie('digital_subscription_tracking_abtest_id') || "",
                            "user_id": ($ as any).cookie('epoch_user_id'),
                            "category": 'ERROR Digital Subscription Checkout',
                            "action": 'createSubscriptionUsingOfferAndCreditCard status != ok',
                            "label": '',
                            "src_cat": window.epCheckoutParams.src_cat,
                            "src_tmp": window.epCheckoutParams.src_tmp,
                            "src_url": window.epCheckoutParams.src_url,
                            "src_cmp": window.epCheckoutParams.src_cmp,
                            "value": '',
                            metadata: window.checkoutEngineVersion,
                            "page": window.location.href,
                            "canonical_url": window.epCheckoutParams.src_url,
                            "real_url": window.epCheckoutParams.src_url,
                            "json_data": JSON.stringify({
                                params: window.epCheckoutParams,
                                checkoutEngineVersion: window.checkoutEngineVersion,
                                response: res,
                                checkoutData: cpState.checkoutData
                            })
                        });
                    } catch (e) {

                    }
                }
            },
            error: function (res) {
                ga('send', 'event', 'Digital Checkout Page', 'ERROR - purchaseSubscription');
                try {
                    window.epSubs.trackDataEvent({
                        "abtest_id": ($ as any).cookie('digital_subscription_tracking_abtest_id') || "",
                        "user_id": ($ as any).cookie('epoch_user_id'),
                        "category": 'ERROR Digital Subscription Checkout',
                        "action": 'createSubscriptionUsingOfferAndCreditCard error response',
                        "label": '',
                        "src_cat": window.epCheckoutParams.src_cat,
                        "src_tmp": window.epCheckoutParams.src_tmp,
                        "src_url": window.epCheckoutParams.src_url,
                        "src_cmp": window.epCheckoutParams.src_cmp,
                        "value": '',
                        metadata: window.checkoutEngineVersion,
                        "page": window.location.href,
                        "canonical_url": window.epCheckoutParams.src_url,
                        "real_url": window.epCheckoutParams.src_url,
                        "json_data": JSON.stringify({
                            params: window.epCheckoutParams,
                            checkoutEngineVersion: window.checkoutEngineVersion,
                            response: res,
                            checkoutData: cpState.checkoutData
                        })
                    });
                } catch (e) {

                }
            }
        });
    },


    createSubsForExistingCustomer: function () {
        let subData = {
            plan_id: cpState.selectedPlanDescription.planId,
            meta_data: cpState.checkoutData.meta_data,
            // meta_data: {
            //     "cf_plan_after_trial_ends": "3-month-$45-digital",
            //     "cf_utm_campaign": "",
            //     "cf_utm_source": "SupportEpoch.com",
            //     "cf_utm_medium": "",
            //     "cf_utm_term": "",
            //     "cf_utm_content": "",
            //     "cf_source_page_url": "",
            //     "cf_impact_clickid": "1-day-5-dollar"
            // }
        }
        if (window.epCheckoutParams.plan_quantity) {
            cpState.checkoutData.plan_quantity = window.epCheckoutParams.plan_quantity;
        }

        const hostName = window.location.hostname;
        let apiUrl = `${this.conductorHostUrl}create_subscription_for_customer`;
        apiUrl += `?site_id=${this.siteID}`;
        apiUrl += `&hostName=${hostName}`;
        apiUrl += `&token=${cpState.customerData.token}`;

        if (cpState.customerData.customer_id) {
            apiUrl = `${apiUrl}&customerid=${cpState.customerData.customer_id}`;
        }
        logThisState("createSubsForExistingCustomer: apiUrl", apiUrl);
        logThisState("createSubsForExistingCustomer: subData", apiUrl);


        return $.ajax({
            method: "POST",
            dataType: "json",
            contentType: "application/json",
            url: apiUrl,
            data: JSON.stringify(subData),
            success: function (res) {
                ga('send', 'event', 'Digital Checkout Page', 'SUCCESS - purchaseSubscription for existing customer');
            },
            error: function (res) {
                ga('send', 'event', 'Digital Checkout Page', 'ERROR - purchaseSubscription for existing customer');

                try {
                    window.epSubs.trackDataEvent({
                        "abtest_id": ($ as any).cookie('digital_subscription_tracking_abtest_id') || "",
                        "user_id": ($ as any).cookie('epoch_user_id'),
                        "category": 'ERROR Digital Subscription Checkout',
                        "action": 'createSubsForExistingCustomer error response',
                        "label": '',
                        "src_cat": window.epCheckoutParams.src_cat,
                        "src_tmp": window.epCheckoutParams.src_tmp,
                        "src_url": window.epCheckoutParams.src_url,
                        "src_cmp": window.epCheckoutParams.src_cmp,
                        "value": '',
                        metadata: window.checkoutEngineVersion,
                        "page": window.location.href,
                        "canonical_url": window.epCheckoutParams.src_url,
                        "real_url": window.epCheckoutParams.src_url,
                        "json_data": JSON.stringify({
                            params: window.epCheckoutParams,
                            checkoutEngineVersion: window.checkoutEngineVersion,
                            response: res,
                            checkoutData: cpState.checkoutData
                        })
                    });
                } catch (e) {

                }

            }
        });
    },

    setPaypalExpressCheckout: function (description: string) {
        const isDev = true;
        const currentUrl = encodeURIComponent(window.location.href)
        const paypalParams = `&return_url=${currentUrl}&cancel_url=${encodeURIComponent('https://www.epochtimes.de')}&amount=${cpState.selectedPlanDescription.planPrice}&description=${encodeURIComponent(description)}&noshipping=true`;
        const siteId = isDev ? 'de-dev.theepochtimes.com' : this.siteID;

        return $.ajax({
            method: "POST",
            dataType: "json",
            contentType: "application/json",
            url: `${this.conductorHostUrl}paypal_express/set_express_checkout?siteId=${siteId}${paypalParams}`,
            data: {}
        });
    },

    createBillingAgreement: function (token: string) {
        const isDev = true;
        const siteId = isDev ? 'de-dev.theepochtimes.com' : this.siteID;
        return $.ajax({
            method: "POST",
            dataType: "json",
            contentType: "application/json",
            url: `${this.conductorHostUrl}paypal_express/create_billing_agreement?siteId=${siteId}&token=${token}`
        });
    },

    getBillingAgreementDetails: function (token: string) {
        const isDev = true;
        const siteId = isDev ? 'de-dev.theepochtimes.com' : this.siteID;
        return $.ajax({
            method: "GET",
            dataType: "json",
            contentType: "application/json",
            url: `${this.conductorHostUrl}paypal_express/get_express_checkout_detail?siteId=${siteId}&token=${token}`
        });
    }
}

// export const subscriptionAPIs = subscriptionAPIs1;

/**
 * call add_abandoned_cart_email with tracking information
 *
 * @param {string} email
 * @returns
 */
function addToAbandonedCartJourney(email: string) {

    // debugger;
    // logThisState("addToAbandonedCartJourney: get query before setting", ($ as any).cookie('epoch_abandoned_cart_journey'));
    if (($ as any).cookie('epoch_abandoned_cart_journey')) {

        return;
    }

    // epoch_abandoned_cart_journey is true, expires in 6 days
    // cookie is set on the theepochtimes.com domain and subdomains
    // does not work on the local testing
    setCookie('epoch_abandoned_cart_journey', true, 6);

    // logThisState("addToAbandonedCartJourney: get query after setting", ($ as any).cookie('epoch_abandoned_cart_journey'));

    // assign random segment for possible AB testing inside journey
    let segments = ['A', 'B', 'C', 'D'];
    let segment = segments[Math.floor(Math.random() * segments.length)];

    let planData = cpState.selectedPlanDescription.plan_id;
    planData += (cpState.selectedPlanDescription.cf_plan_after_trial_ends) ? "---" + cpState.selectedPlanDescription.cf_plan_after_trial_ends : "";
    // sample planData='digitalonly_fullsubscription_1usd_2month_trial---digitalonly_fullsubscription_9_99_monthly'

    // set abandoned cart journey data
    let acData = {
        email: email,
        user_id: ($ as any).cookie("epoch_user_id"),
        cp_type: (cpState.selectedPlanDescription.planType) ? cpState.selectedPlanDescription.planType : "digital",
        url: window.location.href,
        action: planData,
        metadata: "",
        segment: segment
    }

    try {
        logThisState("addToAbandonedCartJourney: try to validate recaptcha");
        // call recaptcha, if successful call add_abandoned_cart_email with acData
        grecaptcha.ready(function () {
            grecaptcha.execute('6LcmJLkZAAAAAMziOnaFrJkOV4ClF_H8OvcqvlyE', {action: 'ac_email'}).then(function (captchaACtoken) {
                try {
                    let url = window.configSubsApiUrl + "/add_abandoned_cart_email?recaptcha=" + encodeURIComponent(captchaACtoken);
                    logThisState("addToAbandonedCartJourney: recaptcha successful");
                    logThisState("addToAbandonedCartJourney: call url", url);
                    logThisState("addToAbandonedCartJourney: with data", acData);
                    $.ajax({
                        type: "POST",
                        dataType: "json",
                        contentType: "application/json",
                        url: url,
                        data: JSON.stringify(acData),
                        success: function (response) {
                            // send it to /db/senddata
                            window.epSubs.trackDataEvent({
                                "user_id": ($ as any).cookie('epoch_user_id') || "",
                                "category": 'Added to Digital Abandoned Cart Journey',
                                "action": planData,
                                "label": email,
                                "value": '',
                                "metadata": window.checkoutEngineVersion,
                                "page": window.extractedURLParams.src_url,
                                "canonical_url": window.extractedURLParams.src_url,
                                "real_url": window.extractedURLParams.src_url,
                                "json_data": JSON.stringify({
                                    params: window.extractedURLParams,
                                    checkoutEngineVersion: window.checkoutEngineVersion,
                                    email: email
                                })
                            });
                        },
                        error: function (response) {
                            logThisState("addToAbandonedCartJourney: error L593, email=" + email + " response=",
                                response
                            );
                            // debugger;
                        }
                    });
                } catch (e) {
                    logThisState("addToAbandonedCartJourney: error L602, exception=", e);
                    // debugger;
                }
            });
        });
    } catch (e) {
        logThisState("addToAbandonedCartJourney: error L607, exception=", e);
        // debugger;
    }
}

function getCookie(key: string) {
    const result = ($ as any).cookie(key);
    logThisState("getCookie: key=" + key + ' result=', result);
    return result;
}

/**
 * Note: this sets the cookie on the domain and subdomain of theepochtimes.com
 * Warning: it will not work for local testing
 *
 * @param {string} key
 * @param {object} value
 * @param {int} expires in days
 * @returns
 */
export function setCookie(key: string, value: boolean, expires: number) {
    if (!($ as any).cookie) {
        // logThisState("setCookie: ($ as any).cookie not defined");
        return false;
    }
    // logThisState("setCookie: set key ", key);
    // logThisState("setCookie: set value ", value);
    ($ as any).cookie(key, value, {
        expires: expires,
        domain: 'theepochtimes.com',
        path: '/'
    });
}


function handleExistingPayment(maskedNumber: string) {
    $('#payment-using-hosted-field-integration').slideUp();
    // slide up: We will create your new subscription with your stored payment method on file.
    // Credit Card ending in:
    $('#existing-card').slideDown();

    // this is a link, and we can swap in braintree-payment with it,
    // basically we just need to reverse the previous action
    $('#show-braintree-payment').click(function (e) {
        e.preventDefault();
        $('#payment-using-hosted-field-integration').slideDown();
        $('#existing-card').slideUp();
    });

    if (maskedNumber) {
        // show paragraph: `Credit Card ending in:`
        $('#card-info-line').show();
        // set the last 4 digits
        $('#last-four').empty().append(maskedNumber);
    }
}

// sfh-split-file-here

/**
 * Communicate with user that they already have a subscription
 * @param {string} subscription_type
 */
function handleExistingSubscription(subscription_type: number) {
    // debugger; // is this on the handleExistingSubscription
    // hide customer name
    $('#customer-name-container').slideUp();
    // $('#customer-fname').parent().slideUp();
    // $('#customer-lname').parent().slideUp();
    // hide braintree integration
    $('#payment-stripe').slideUp();
    $('#payment-using-hosted-field-integration').slideUp();
    // hide submit button
    $('.cb-main-footer').slideUp();

    logThisState("handleExistingSubscription: subscription_type", subscription_type);
    logThisState("handleExistingSubscription: cpState.isLoggedIn", cpState.isLoggedIn); // debugger;

    if (digital_prod_id.includes(subscription_type)) {
        $('#checkout-form .loading-throbber-wrapper').hide();
        if (cpState.isLoggedIn) { // debugger;
            // shows info: We see that you already have a subscription with full digital access!
            // In case you forgot your password, click here to request a reset password link.
            $('#existing-sub').slideDown();
            $('.read-footer').slideDown();
            logThisState("handleExistingSubscription: show you have an existing subscription and you are logged in");
        } else {
            // shows: You may have an active subscription already, please log into your account to complete this transaction.
            $('#existing-sub-logged-out').slideDown();
            const MSG_SHOW_EXISTING_SUBSCRIPTION_NOT_LOGGED_IN = "handleExistingSubscription: show you have an existing subscription and you are NOT logged in";
            logThisState(MSG_SHOW_EXISTING_SUBSCRIPTION_NOT_LOGGED_IN);
        }
    }

    $('#resetpw').on('click',
        async function (e) {
            e.preventDefault();
            const checkoutData = cpState.checkoutData;
            const customerData = cpState.customerData;
            const email = (checkoutData.customer && checkoutData.customer.email) || customerData.email;
            await subscriptionAPIs.requestResetPassword(email);
            $('#reset-success').slideDown();
        }
    );

    $('#go-to-eet').on('click',
        function (e) {
            e.preventDefault();
            window.location.href = "https://theepochtimes.com";
        }
    );

}

function getMoneyString(amountInCents: number) {
    if (amountInCents % 100 > 0) {
        return (amountInCents / 100).toFixed(2);
    } else {
        return (amountInCents / 100).toString();
    }
}

function isStripePaymentSelected() {
    let gatewayFound = 2; // default gateway 2~STRIPE

    if (cpState &&
        cpState.offerDetail &&
        cpState.offerDetail.offer_detail &&
        cpState.offerDetail.offer_detail.plan &&
        cpState.offerDetail.offer_detail.plan.product &&
        cpState.offerDetail.offer_detail.plan.product.default_gateway
    ) {
        gatewayFound = cpState.offerDetail.offer_detail.plan.product.default_gateway;
        logThisState("isStripePaymentSelected: gatewayFound --- Btest: ", gatewayFound);
    } else {
        logError("Could not read gatewayFound --- Btest ", cpState.offerDetail.offer_detail.plan.product.default_gateway);
    }

    const stripeFound = ((gatewayFound == 2) || (gatewayFound == 3))
    logThisState("isStripePaymentSelected: stripeFound: ", stripeFound);
    logThisState("isStripePaymentSelected: gatewayFound: ", gatewayFound);

    return stripeFound;
}

function getLocalizedText(lang: string, messageKey: string): string {
    if (localizedMessages[lang] && localizedMessages[lang][messageKey]) {
        return localizedMessages[lang][messageKey];
    } else {
        console.warn(`The key "${messageKey}" does not exist in the language "${lang}"`);
        return '';
    }
}

function outputLocalizedText(selector: string, messageKey: string, lang: string = currentLanguage): void {
    $(selector).text(getLocalizedText(lang, messageKey));
}


