import React, { useState } from 'react';
import { Container, Form, Button } from 'react-bootstrap';
import { db } from '../firebaseConfig'; // Make sure you have this file set up as per previous instructions

const Contact = () => {
  // State hooks to store form field values
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  // Function to handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();

    // Add a new document with a generated id to the 'messages' collection
    db.collection('messages').add({
      email: email,
      message: message,
      createdAt: new Date()
    })
    .then(() => {
      alert('Message has been submitted!');
      // Reset form fields after submission
      setEmail('');
      setMessage('');
    })
    .catch((error) => {
      alert(error.message);
    });
  };

  return (
    <Container id='contact' className="my-5">
      <h3>Contact Me</h3>
      <Form onSubmit={handleSubmit}>
        <Form.Group controlId="formBasicEmail">
          <Form.Label>Email Address</Form.Label>
          <Form.Control 
            type="email" 
            placeholder="Enter email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Form.Group>

        <Form.Group controlId="formBasicMessage">
          <Form.Label>Message</Form.Label>
          <Form.Control 
            as="textarea" 
            rows={3} 
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </Form.Group>

        <Button variant="primary" type="submit">
          Submit
        </Button>
      </Form>
    </Container>
  );
};

export default Contact;
