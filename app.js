new Vue({
    el: '#app',
    data: {
        apiToken: localStorage.getItem('apiToken') || '',
        userInput: '',
        conversationHistory: JSON.parse(localStorage.getItem('conversationHistory')) || [],
        selectedImage: null,
        selectedImageDataUrl: null,
        apiTokenSaved: false,
        errorMessage: ''
    },
    created() {
        this.apiTokenSaved = localStorage.getItem('apiToken') !== null;
    },
    methods: {
        clearLocalChat() {
            localStorage.removeItem('conversationHistory');
            this.conversationHistory = [];
        },
        saveApiToken() {
            localStorage.setItem('apiToken', this.apiToken);
        },
        uploadImage(event) {
            this.selectedImage = event.target.files[0];
            if (this.selectedImage) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    this.selectedImageDataUrl = e.target.result;
                };
                reader.readAsDataURL(this.selectedImage);
            }
        },
        sendMessage() {
            this.errorMessage = null;
            if (!this.apiToken) {
                this.errorMessage = 'Please enter an API token.';
                return;
            }
            if (!this.userInput && !this.selectedImage) {
                this.errorMessage = 'Please enter a message or upload an image.';
                return;
            }

            let messageContent = [{ type: 'text', text: this.userInput }];
            if (this.selectedImage) {
                let formData = new FormData();
                formData.append("file", this.selectedImage);

                fetch("https://tmpfiles.org/api/v1/uploadd", {
                    method: "POST",
                    body: formData
                })
                    .then(response => {
                        if (!response.ok) {
                            // If the response status is not in the range 200-299,
                            // we consider it an error and throw to trigger the catch block.
                            return Promise.reject(`HTTP error! status: ${response.status}`);
                        }
                        return response.json();
                    })
                    .then(data => {
                        if (data.status === 'success') {
                            let originalUrl = data.data.url; // Get url from the response
                            let correctedUrl = originalUrl.replace(/(\/\d+\/)/, '/dl$1');
                            messageContent.push({ type: 'image_url', image_url: { url: correctedUrl }});
                            this.proceedToSendMessage(messageContent);
                        } else {
                            this.errorMessage = `Error: Image upload unsuccessful.`;
                            console.error('Error: Image upload unsuccessful.');
                        }
                    })
                    .catch(error => {
                        this.errorMessage = `Error uploading the image: ${error}`;
                        console.log(error);
                    });
            } else {
                this.proceedToSendMessage(messageContent);
            }
        },
        proceedToSendMessage(messageContent) {
            let message = {
                role: 'user',
                content: messageContent
            };
            this.conversationHistory.push(message);

            // Add the loading spinner
            this.conversationHistory.push({ role: 'assistant', loading: true });

            this.userInput = '';
            this.selectedImage = null;
            this.selectedImageDataUrl = null;
            this.sendRequest();
        },
        sendRequest() {
            const messages = this.conversationHistory
                .filter(msg => msg.role === 'user')
                .map(msg => ({ role: msg.role, content: msg.content }));

            fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiToken}` },
                body: JSON.stringify({
                    model: 'gpt-4o',
                    messages: messages
                })
            })
                .then(response => {
                    if (!response.ok) {
                        // If the response status is not in the range 200-299,
                        // we consider it an error and throw to trigger the catch block.
                        return Promise.reject(`HTTP error! status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    if (data && data.choices && data.choices[0] && data.choices[0].message) {
                        const response = data.choices[0].message.content.trim();

                        // Find the loading message and remove it
                        const loadingIndex = this.conversationHistory.findIndex(msg => msg.loading);
                        if (loadingIndex !== -1) {
                            this.conversationHistory.splice(loadingIndex, 1);
                        }

                        this.conversationHistory.push({ role: 'assistant', content: response });
                        this.saveConversationHistory();
                        this.scrollToBottom();
                        this.apiTokenSaved = true;
                    }
                })
                .catch(error => {
                    this.errorMessage = `Chat error: ${error}`;
                    console.error('Error:', error);

                    // Remove the loading message if there is an error
                    const loadingIndex = this.conversationHistory.findIndex(msg => msg.loading);
                    if (loadingIndex !== -1) {
                        this.conversationHistory.splice(loadingIndex, 1);
                    }
                });
        },
        saveConversationHistory() {
            localStorage.setItem('conversationHistory', JSON.stringify(this.conversationHistory));
        },
        scrollToBottom() {
            this.$nextTick(() => {
                const container = this.$refs.conversation;
                container.scrollTop = container.scrollHeight;
            });
        },
        renderMarkdown(content) {
            return marked.parse(content);
        }
    }
});