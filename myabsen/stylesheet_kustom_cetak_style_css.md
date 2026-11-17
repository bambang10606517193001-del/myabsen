/* ==========================================================================
   Stylesheet Kustom - PP. Nurul Chalik Sistem Absensi QR Code
   ========================================================================== */

body {
    font-family: 'Plus Jakarta Sans', sans-serif;
}

.glass-card {
    background: rgba(255, 255, 255, 0.96);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
}

#qr-reader video,
#native-qr-video {
    border-radius: 0.75rem !important;
    object-fit: cover !important;
}

/* Custom Scrollbar untuk Navigasi & Tabel */
::-webkit-scrollbar {
    width: 6px;
    height: 6px;
}

::-webkit-scrollbar-track {
    background: transparent;
}

::-webkit-scrollbar-thumb {
    background: rgba(100, 116, 139, 0.28);
    border-radius: 9999px;
}

::-webkit-scrollbar-thumb:hover {
    background: rgba(100, 116, 139, 0.45);
}

/* Pengaturan Cetak Laporan Resmi / PDF */
@media print {
    body * {
        visibility: hidden;
    }
    #print-area,
    #print-area * {
        visibility: visible;
    }
    #print-area {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        padding: 0;
        margin: 0;
        border: none !important;
    }
    .no-print {
        display: none !important;
    }
}