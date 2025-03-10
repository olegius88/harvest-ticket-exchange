package com.talonkombainera.maps

// Класс данных для JSON
data class PushUserIdResponse(
    val reqId: String,
    val native: PushUserIdResponseNative
)