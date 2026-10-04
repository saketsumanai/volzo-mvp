package com.volzo.core.util

import java.util.regex.Pattern

object Validators {
    private val PAN_PATTERN = Pattern.compile("[A-Z]{5}[0-9]{4}[A-Z]{1}")
    private val IFSC_PATTERN = Pattern.compile("^[A-Z]{4}0[A-Z0-9]{6}$")
    private val ACCOUNT_PATTERN = Pattern.compile("^[0-9]{9,18}$")
    private val DL_PATTERN = Pattern.compile("^[A-Z]{2}[0-9]{2}[0-9]{11}$|^[A-Z]{2}-[0-9]{13}$")
    private val VEHICLE_PATTERN = Pattern.compile("^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$|^[A-Z]{2}[0-9]{2}[0-9]{4}$")

    fun isValidPan(pan: String): Boolean {
        return PAN_PATTERN.matcher(pan.uppercase().trim()).matches()
    }

    fun isValidIfsc(ifsc: String): Boolean {
        return IFSC_PATTERN.matcher(ifsc.uppercase().trim()).matches()
    }

    fun isValidAccountNumber(acc: String): Boolean {
        return ACCOUNT_PATTERN.matcher(acc.trim()).matches()
    }

    fun isValidDrivingLicense(dl: String): Boolean {
        val cleanDl = dl.uppercase().trim().replace(" ", "")
        return DL_PATTERN.matcher(cleanDl).matches() || cleanDl.length >= 10
    }

    fun isValidVehicleNumber(vNo: String): Boolean {
        val cleanVNo = vNo.uppercase().trim().replace(" ", "").replace("-", "")
        return VEHICLE_PATTERN.matcher(cleanVNo).matches() || cleanVNo.length >= 8
    }

    fun isValidPhone(phone: String): Boolean {
        val cleanPhone = phone.replace("\\D".toRegex(), "")
        return cleanPhone.length == 10 || (cleanPhone.length == 12 && cleanPhone.startsWith("91"))
    }
}
