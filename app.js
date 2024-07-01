new Vue({
    el: '#app',
    data: {
        apiToken: localStorage.getItem('apiToken') || '',
        userInput: '',
        conversationHistory: JSON.parse(localStorage.getItem('conversationHistory')) || [],
        selectedImage: null,
        isLoading: false // Track loading state
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
        },
        sendMessage() {
            if (!this.apiToken) {
                alert('Please enter an API token.');
                return;
            }
            if (!this.userInput && !this.selectedImage) {
                alert('Please enter a message or upload an image.');
                return;
            }

            let messageContent = [{ type: 'text', text: this.userInput }];
            if (this.selectedImage) {
                let formData = new FormData();
                formData.append("file", this.selectedImage);

                fetch("https://tmpfiles.org/api/v1/upload", {
                    method: "POST",
                    body: formData
                })
                    .then(response => response.json())
                    .then(data => {
                        if (data.status === 'success') {
                            let originalUrl = data.data.url; // Get url from the response
                            let correctedUrl = originalUrl.replace(/(\/\d+\/)/, '/dl$1');
                            messageContent.push({ type: 'image_url', image_url: { url: correctedUrl }});
                            this.proceedToSendMessage(messageContent);
                        } else {
                            console.error('Error: Image upload unsuccessful.');
                        }
                    })
                    .catch(error => console.log(error));
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
                .then(response => response.json())
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
                    }
                })
                .catch(error => {
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
    },
    updated() {
        this.scrollToBottom();
    }
});