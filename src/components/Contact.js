import React, { useState } from 'react';
import { Container, Form, Button, Card } from 'react-bootstrap';
import { db } from '../firebaseConfig';
import { collection, addDoc } from 'firebase/firestore';
import { BiRightArrowAlt } from 'react-icons/bi';

const Contact = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await addDoc(collection(db, "messages"), {
        email,
        message,
        createdAt: new Date()
      });
      alert('Message has been sent!');
      setEmail('');
      setMessage('');
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <Container id='contact' className="my-5">
      <Card style={{ border: 'none', boxShadow: 'none' }}> {/* Inline style to remove border and shadow */}
        <Card.Body>
          <h3>contact me</h3>
          <Form onSubmit={handleSubmit}>
            <Form.Group controlId="formBasicEmail" className="mb-3">
              <Form.Label className="no-side-padding no-side-margin">email address</Form.Label>
              <Form.Control 
                type="email" 
                placeholder="enter email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Form.Group>

            <Form.Group controlId="formBasicMessage" className="mb-3">
              <Form.Label className="no-side-padding no-side-margin">message</Form.Label>
              <Form.Control 
                as="textarea" 
                placeholder="type message" 
                rows={3} 
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </Form.Group>

            <Button type="submit" className="send-button mt-3"> send message
            <BiRightArrowAlt className="arrow-icon2" />
            </Button>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default Contact;
