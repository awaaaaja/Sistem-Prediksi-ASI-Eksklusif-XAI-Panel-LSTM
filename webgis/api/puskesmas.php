<?php
include 'config.php';

$conn = new mysqli($host, $user, $pass, $dbname);
if ($conn->connect_error) {
    die(json_encode(["error" => "Koneksi gagal"]));
}

$sql = "SELECT nama, kecamatan, lat, lng FROM puskesmas";
$result = $conn->query($sql);

$puskesmas = [];
while ($row = $result->fetch_assoc()) {
    $puskesmas[] = $row;
}

header('Content-Type: application/json');
echo json_encode($puskesmas);
