// Function to show the instruction popup
function showInstructionPopup() {
    const popup = document.getElementById('instruction-popup');
    popup.style.display = 'block';  // Show the popup
}

// Function to close the instruction popup
function closeInstructionPopup() {
    const popup = document.getElementById('instruction-popup');
    popup.style.display = 'none';  // Hide the popup
}

// Event listener for the "How to Use" button
document.getElementById('info-button').addEventListener('click', function () {
    showInstructionPopup();
});

// Event listener for the close button in the popup
document.querySelector('.popup-close').addEventListener('click', function () {
    closeInstructionPopup();
});
