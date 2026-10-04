package com.volzo.core.payment

import android.app.Activity
import com.razorpay.Checkout
import org.json.JSONObject

class RazorpayHelper(private val activity: Activity) {

    init {
        Checkout.preload(activity.applicationContext)
    }

    fun startPayment(
        amount: Double,
        orderId: String,
        email: String,
        contact: String
    ) {
        val checkout = Checkout()
        // Production note: API key should be fetched from BuildConfig or encrypted secure storage
        checkout.setKeyID("rzp_test_your_key_id")

        try {
            val options = JSONObject()
            options.put("name", "Volzo Mobility")
            options.put("description", "Ride Payment")
            options.put("image", "https://volzo.com/logo.png")
            options.put("order_id", orderId)
            options.put("theme.color", "#0066FF")
            options.put("currency", "INR")
            options.put("amount", (amount * 100).toInt())
            options.put("prefill.email", email)
            options.put("prefill.contact", contact)

            val retryObj = JSONObject()
            retryObj.put("enabled", true)
            retryObj.put("max_count", 4)
            options.put("retry", retryObj)

            checkout.open(activity, options)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}
