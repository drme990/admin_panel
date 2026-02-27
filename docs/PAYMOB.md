<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light dark">
    <title>APIs</title>
  </head>
  <body>
    <main>
      <article>
        <pre style="word-wrap: break-word; white-space: pre-wrap;">&lt;Card attributes=&#039;{&quot;isFitToPage&quot;:true,&quot;style&quot;:{&quot;width&quot;:&quot;100%&quot;},&quot;iconUrl&quot;:&quot;https://d14vbsg24p2jga.cloudfront.net/9f43ec87-6e1f-4f2f-8f3d-0f13ed673fc0-696ce029f28038f7d24990ca.svg&quot;}&#039;&gt;
  &lt;title&gt;&lt;/title&gt;
  &lt;description&gt;&lt;strong class=&quot;slate-bold&quot;&gt;Who is this for - &lt;/strong&gt;
&lt;p&gt;Product managers and developers who need a high-level overview of how to integrate through APIs and our available checkout experiences&lt;/p&gt;
&lt;strong class=&quot;slate-bold&quot;&gt;Outcome - &lt;/strong&gt;
&lt;p&gt;Understand the overall API payment flow, the available checkout options, and how payment results are securely communicated back to your system&lt;/p&gt;&lt;/description&gt;
&lt;/Card&gt;&lt;Divider /&gt;

## When should you use APIs?

Use Paymob APIs if you are:

- Building a **custom website** without a CMS or ready-made plugin
- Using a platform that allows **calling third-party APIs** but has no direct Paymob integration
- Building a **mobile app** and choosing to use a **web-based checkout in a WebView** instead of a native SDK

APIs give you flexibility while still relying on Paymob’s secure payment infrastructure.

## Integration flow

&lt;Steps attributes=&#039;{&quot;style&quot;:{&quot;width&quot;:&quot;100%&quot;,&quot;minWidth&quot;:&quot;100%&quot;}}&#039;&gt;
&lt;Step stepNumber=&quot;1&quot; title=&quot;&quot;&gt;
&lt;p&gt;Create a payment intention&lt;/p&gt;&lt;p&gt;Every payment starts by calling the&lt;/p&gt;&lt;strong class=&quot;slate-bold&quot;&gt;Intention Creation API&lt;/strong&gt;&lt;p&gt;from your backend. You can check it in the&lt;/p&gt;&lt;a href=&quot;https://developers.paymob.com/paymob-docs/developers/intention-apis/overview&quot; target=&quot;&quot;&gt;&lt;strong class=&quot;slate-bold&quot;&gt;Intention APIs&lt;/strong&gt;&lt;/a&gt;&lt;p&gt;section.&lt;/p&gt;&lt;p&gt;This step initializes the payment by defining:&lt;/p&gt;&lt;ul class=&quot;slate-ul &quot;&gt;&lt;li class=&quot;slate-li &quot;&gt;&lt;div style=&quot;position:relative&quot;&gt;Amount and currency&lt;/div&gt;&lt;/li&gt;&lt;li class=&quot;slate-li &quot;&gt;&lt;div style=&quot;position:relative&quot;&gt;Allowed payment methods&lt;/div&gt;&lt;/li&gt;&lt;li class=&quot;slate-li &quot;&gt;&lt;div style=&quot;position:relative&quot;&gt;Your internal order or reference ID&lt;/div&gt;&lt;/li&gt;&lt;/ul&gt;&lt;p&gt;The response includes a reference (client secret) that is used to launch the checkout experience.&lt;/p&gt;
&lt;/Step&gt;
&lt;Step stepNumber=&quot;2&quot; title=&quot;&quot;&gt;
&lt;p&gt;Display a checkout experience to the customer&lt;/p&gt;&lt;p&gt;Once the intention is created, you present one of Paymob’s checkout experiences:&lt;/p&gt;&lt;strong class=&quot;slate-bold&quot;&gt;Unified Checkout (Redirect)&lt;/strong&gt;&lt;ul class=&quot;slate-ul &quot;&gt;&lt;li class=&quot;slate-li &quot;&gt;&lt;div style=&quot;position:relative&quot;&gt;Customer is redirected to a &lt;a href=&quot;https://developers.paymob.com/paymob-docs/developers/checkout-experiences/overview&quot; target=&quot;&quot;&gt;&lt;strong class=&quot;slate-bold&quot;&gt;Paymob-hosted checkout&lt;/strong&gt;&lt;/a&gt; page&lt;/div&gt;&lt;/li&gt;&lt;li class=&quot;slate-li &quot;&gt;&lt;div style=&quot;position:relative&quot;&gt;Fastest integration with minimal frontend effort&lt;/div&gt;&lt;/li&gt;&lt;li class=&quot;slate-li &quot;&gt;&lt;div style=&quot;position:relative&quot;&gt;Paymob handles UI, validation, and security&lt;/div&gt;&lt;/li&gt;&lt;/ul&gt;&lt;strong class=&quot;slate-bold&quot;&gt;Embedded Checkout (Pixel)&lt;/strong&gt;&lt;ul class=&quot;slate-ul &quot;&gt;&lt;li class=&quot;slate-li &quot;&gt;&lt;div style=&quot;position:relative&quot;&gt;Paymob checkout UI component (&lt;a href=&quot;https://developers.paymob.com/paymob-docs/developers/checkout-experiences/pixel-embedded&quot; target=&quot;&quot;&gt;&lt;strong class=&quot;slate-bold&quot;&gt;Pixel&lt;/strong&gt;&lt;/a&gt;) is embedded inside your website or WebView&lt;/div&gt;&lt;/li&gt;&lt;li class=&quot;slate-li &quot;&gt;&lt;div style=&quot;position:relative&quot;&gt;More control over the checkout look and feel&lt;/div&gt;&lt;/li&gt;&lt;li class=&quot;slate-li &quot;&gt;&lt;div style=&quot;position:relative&quot;&gt;Sensitive payment data is still handled securely by Paymob&lt;/div&gt;&lt;/li&gt;&lt;/ul&gt;
&lt;/Step&gt;
&lt;Step stepNumber=&quot;3&quot; title=&quot;&quot;&gt;
&lt;p&gt;Customer completes or cancels the payment&lt;/p&gt;&lt;p&gt;The customer enters their payment details and completes any required authentication (such as 3D Secure). Paymob processes the transaction and determines the final payment status.&lt;/p&gt;
&lt;/Step&gt;
&lt;Step stepNumber=&quot;4&quot; title=&quot;&quot;&gt;
&lt;p&gt;Callbacks (Webhooks)&lt;/p&gt;&lt;p&gt;After processing the payment, Paymob sends&lt;/p&gt;&lt;a href=&quot;https://developers.paymob.com/paymob-docs/developers/webhook-callbacks-and-hmac/overview&quot; target=&quot;&quot;&gt;&lt;strong class=&quot;slate-bold&quot;&gt;callbacks&lt;/strong&gt;&lt;/a&gt;&lt;p&gt;to your backend to notify you of the payment result and redirects the customer back to your website or app.&lt;/p&gt;&lt;p&gt;Callbacks should be used to:&lt;/p&gt;&lt;ul class=&quot;slate-ul &quot;&gt;&lt;li class=&quot;slate-li &quot;&gt;&lt;div style=&quot;position:relative&quot;&gt;Confirm the final payment status&lt;/div&gt;&lt;/li&gt;&lt;li class=&quot;slate-li &quot;&gt;&lt;div style=&quot;position:relative&quot;&gt;Update order records&lt;/div&gt;&lt;/li&gt;&lt;li class=&quot;slate-li &quot;&gt;&lt;div style=&quot;position:relative&quot;&gt;Trigger business actions (e.g., fulfillment, notifications)&lt;/div&gt;&lt;/li&gt;&lt;li class=&quot;slate-li &quot;&gt;&lt;div style=&quot;position:relative&quot;&gt;Redirects are mainly for user experience&lt;/div&gt;&lt;/li&gt;&lt;li class=&quot;slate-li &quot;&gt;&lt;div style=&quot;position:relative&quot;&gt;&lt;strong class=&quot;slate-bold&quot;&gt;Callbacks are the source of truth&lt;/strong&gt; for payment status&lt;/div&gt;&lt;/li&gt;&lt;/ul&gt;
&lt;/Step&gt;
&lt;Step stepNumber=&quot;5&quot; title=&quot;&quot;&gt;
&lt;p&gt;Callback security (HMAC)&lt;/p&gt;&lt;p&gt;Each callback can be authenticated using&lt;/p&gt;&lt;a href=&quot;https://developers.paymob.com/paymob-docs/developers/webhook-callbacks-and-hmac/hmac&quot; target=&quot;&quot;&gt;&lt;strong class=&quot;slate-bold&quot;&gt;HMAC verification&lt;/strong&gt;&lt;/a&gt;&lt;p&gt;to ensure it was sent by Paymob and was not altered. Always verify callbacks before trusting their data.&lt;/p&gt;
&lt;/Step&gt;
&lt;/Steps&gt;</pre>

</article>
</main>

  </body>
</html>
