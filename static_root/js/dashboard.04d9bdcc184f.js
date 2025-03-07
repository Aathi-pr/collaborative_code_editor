function shareRoom(roomId) {
    const shareLink = `${window.location.origin}/editor/?room=${roomId}`;
    document.getElementById('shareLink').value = shareLink;
    document.getElementById('shareModal').classList.add('show');
}

function copyShareLink() {
    const linkInput = document.getElementById('shareLink');
    linkInput.select();
    document.execCommand('copy');
    showNotification('Link copied to clipboard!');
}

function closeModal() {
    document.getElementById('shareModal').classList.remove('show');
}

function deleteRoom(roomId) {
    if (confirm('Are you sure you want to delete this room?')) {
        // Add delete room logic
    }
}

function showNotification(message, type = 'success') {
    // Add notification logic
}