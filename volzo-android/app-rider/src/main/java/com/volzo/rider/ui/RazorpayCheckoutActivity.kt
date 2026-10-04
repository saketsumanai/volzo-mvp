package com.volzo.rider.ui

import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.google.firebase.firestore.FirebaseFirestore
import com.razorpay.Checkout
import com.razorpay.PaymentResultListener
import com.volzo.core.model.Payment
import com.volzo.core.model.Ride
import org.json.JSONObject

class RazorpayCheckoutActivity : AppCompatActivity(), PaymentResultListener {

    private val firestore = FirebaseFirestore.getInstance()
    private var rideId: String = ""
    private var amount: Double = 0.0
    private var razorpayKeyId: String = "rzp_test_your_key_id"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        rideId = intent.getStringExtra("RIDE_ID") ?: ""
        amount = intent.getDoubleExtra("AMOUNT", 0.0)

        Checkout.preload(applicationContext)

        if (rideId.isNotEmpty() && amount > 0) {
            startPayment()
        } else {
            Toast.makeText(this, "Invalid ride fare parameters", Toast.LENGTH_SHORT).show()
            finish()
        }
    }

    private fun startPayment() {
        val checkout = Checkout()
        checkout.setKeyID(razorpayKeyId)

        try {
            val options = JSONObject()
            options.put("name", "Volzo Mobility")
            options.put("description", "EV Ride Fare Payment")
            options.put("theme.color", "#0040C8")
            options.put("currency", "INR")
            options.put("amount", (amount * 100).toInt())
            
            val prefill = JSONObject()
            prefill.put("email", "rider@volzo.com")
            prefill.put("contact", "9876543210")
            options.put("prefill", prefill)

            checkout.open(this, options)
        } catch (e: Exception) {
            Toast.makeText(this, "Error in payment: " + e.message, Toast.LENGTH_SHORT).show()
        }
    }

    override fun onPaymentSuccess(razorpayPaymentId: String?) {
        val paymentRef = firestore.collection("payments").document()
        val payment = Payment(
            id = paymentRef.id,
            rideId = rideId,
            amount = amount,
            method = "RAZORPAY",
            status = "DRIVER_VERIFIED",
            razorpayPaymentId = razorpayPaymentId
        )

        paymentRef.set(payment).addOnSuccessListener {
            firestore.collection("rides").document(rideId)
                .update("status", "PAYMENT_VERIFIED")
                .addOnSuccessListener {
                    Toast.makeText(this, "Payment Successful! 🎉", Toast.LENGTH_LONG).show()
                    finish()
                }
        }
    }

    override fun onPaymentError(code: Int, response: String?) {
        Toast.makeText(this, "Payment Failed: $response", Toast.LENGTH_LONG).show()
        finish()
    }
}
